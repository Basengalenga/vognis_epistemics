output "url" {
  description = "Open this once the first boot has finished building."
  value       = "http://${aws_instance.vognis.public_ip}"
}

output "health" {
  description = "API health check."
  value       = "http://${aws_instance.vognis.public_ip}:8000/health"
}
