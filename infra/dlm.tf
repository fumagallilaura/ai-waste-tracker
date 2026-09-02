# Data Lifecycle Manager - Weekly EBS Snapshots
resource "aws_dlm_lifecycle_policy" "ebs_snapshots" {
  description        = "Weekly EBS snapshots for ${var.app_name} backend"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    schedule {
      name = "Weekly Snapshot"

      create_rule {
        interval      = 7
        interval_unit = "DAYS"
        times         = ["03:00"]
      }

      retain_rule {
        count = 4
      }

      tags_to_add = {
        SnapshotCreator = "DLM"
        Project         = var.app_name
      }

      copy_tags = true
    }

    target_tags = {
      Name = "${var.app_name}-backend-root"
    }
  }
}

# IAM Role for DLM
resource "aws_iam_role" "dlm" {
  name = "${var.app_name}-dlm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "dlm.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "dlm" {
  name = "${var.app_name}-dlm-policy"
  role = aws_iam_role.dlm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateSnapshot",
          "ec2:CreateSnapshots",
          "ec2:DeleteSnapshot",
          "ec2:DescribeVolumes",
          "ec2:DescribeSnapshots"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateTags"
        ]
        Resource = "arn:aws:ec2:*::snapshot/*"
      }
    ]
  })
}
