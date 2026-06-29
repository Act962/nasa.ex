interface SendInstagramDmParams {
  accessToken: string
  recipientId: string
  text: string
}

export async function sendInstagramDm({ accessToken, recipientId, text }: SendInstagramDmParams) {
  const response = await fetch("https://graph.facebook.com/v19.0/me/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Instagram DM error: ${JSON.stringify(error)}`)
  }

  return response.json()
}
