#!/usr/bin/env bash
# Subscribe an email to Wajah notifications. Optional agency filter (PWD, MCD, DPCC, "Traffic Police", Residents).
# Usage: scripts/subscribe.sh you@example.com [AGENCY]
# AWS emails a confirmation link; nothing arrives until it is clicked.
set -euo pipefail
EMAIL="$1"; AGENCY="${2:-}"
TOPIC=$(aws cloudformation describe-stacks --stack-name wajah --query "Stacks[0].Outputs[?OutputKey=='AlertsTopicArn'].OutputValue" --output text)
if [ -n "$AGENCY" ]; then
  aws sns subscribe --topic-arn "$TOPIC" --protocol email --notification-endpoint "$EMAIL" \
    --attributes "{\"FilterPolicy\":\"{\\\"agency\\\":[\\\"$AGENCY\\\"]}\"}" --query SubscriptionArn --output text
  echo "Subscribed $EMAIL to $AGENCY notifications only. Click the link in the AWS confirmation email."
else
  aws sns subscribe --topic-arn "$TOPIC" --protocol email --notification-endpoint "$EMAIL" --query SubscriptionArn --output text
  echo "Subscribed $EMAIL to all notifications. Click the link in the AWS confirmation email."
fi
