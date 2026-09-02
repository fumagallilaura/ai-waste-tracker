variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "sa-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "desperdicio-zero"
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "jwt_private_key" {
  description = "JWT RSA private key (PEM format)"
  type        = string
  sensitive   = true
}

variable "jwt_public_key" {
  description = "JWT RSA public key (PEM format)"
  type        = string
  sensitive   = true
}

variable "mercado_pago_access_token" {
  description = "Mercado Pago access token"
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend API key for email"
  type        = string
  sensitive   = true
}
