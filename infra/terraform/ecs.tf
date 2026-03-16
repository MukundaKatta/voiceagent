resource "aws_ecs_cluster" "main" {
  name = "voiceagent-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "voice_server" {
  name              = "/ecs/voiceagent-voice-server-${var.environment}"
  retention_in_days = 30
}

resource "aws_ecs_task_definition" "voice_server" {
  family                   = "voiceagent-voice-server-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.voice_server_cpu
  memory                   = var.voice_server_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "voice-server"
    image = var.voice_server_image

    portMappings = [{
      containerPort = var.voice_server_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "VOICE_SERVER_PORT", value = tostring(var.voice_server_port) },
      { name = "VOICE_SERVER_WS_URL", value = "wss://${var.domain_name}/ws" },
      { name = "SUPABASE_URL", value = var.supabase_url },
      { name = "SUPABASE_SERVICE_ROLE_KEY", value = var.supabase_service_role_key },
      { name = "TWILIO_ACCOUNT_SID", value = var.twilio_account_sid },
      { name = "TWILIO_AUTH_TOKEN", value = var.twilio_auth_token },
      { name = "TWILIO_PHONE_NUMBER", value = var.twilio_phone_number },
      { name = "INTERNAL_API_KEY", value = var.internal_api_key },
      { name = "AWS_REGION", value = var.aws_region },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.voice_server.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -q -O /dev/null http://localhost:${var.voice_server_port}/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_service" "voice_server" {
  name            = "voiceagent-voice-server-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.voice_server.arn
  desired_count   = var.min_capacity
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.voice_server.arn
    container_name   = "voice-server"
    container_port   = var.voice_server_port
  }

  depends_on = [aws_lb_listener.https]
}

# Auto-scaling
resource "aws_appautoscaling_target" "voice_server" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.voice_server.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "voice_server_cpu" {
  name               = "voiceagent-voice-server-cpu-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.voice_server.resource_id
  scalable_dimension = aws_appautoscaling_target.voice_server.scalable_dimension
  service_namespace  = aws_appautoscaling_target.voice_server.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# IAM Roles
resource "aws_iam_role" "ecs_execution" {
  name = "voiceagent-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "voiceagent-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "bedrock_access" {
  name = "bedrock-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ]
      Resource = "*"
    }]
  })
}
