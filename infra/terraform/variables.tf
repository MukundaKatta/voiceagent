variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "domain_name" {
  type        = string
  description = "Domain for the voice server (e.g. voice.yourdomain.com)"
}

variable "voice_server_image" {
  type        = string
  description = "ECR image URI for the voice server"
}

variable "voice_server_port" {
  type    = number
  default = 8080
}

variable "voice_server_cpu" {
  type    = number
  default = 512
}

variable "voice_server_memory" {
  type    = number
  default = 1024
}

variable "min_capacity" {
  type    = number
  default = 1
}

variable "max_capacity" {
  type    = number
  default = 10
}

variable "supabase_url" {
  type      = string
  sensitive = true
}

variable "supabase_service_role_key" {
  type      = string
  sensitive = true
}

variable "twilio_account_sid" {
  type      = string
  sensitive = true
}

variable "twilio_auth_token" {
  type      = string
  sensitive = true
}

variable "twilio_phone_number" {
  type      = string
  sensitive = true
}

variable "internal_api_key" {
  type      = string
  sensitive = true
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS"
}

variable "hosted_zone_id" {
  type        = string
  description = "Route53 hosted zone ID"
}
