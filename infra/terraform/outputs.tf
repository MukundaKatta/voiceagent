output "ecr_repository_url" {
  value = aws_ecr_repository.voice_server.repository_url
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "voice_server_service_name" {
  value = aws_ecs_service.voice_server.name
}
