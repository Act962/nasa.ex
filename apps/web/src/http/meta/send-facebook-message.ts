interface SendFacebookMessageParams {
  pageId: string
  pageAccessToken: string
  recipientId: string
  text: string
}

export async function sendFacebookMessage({ pageId, pageAccessToken, recipientId, text }: SendFacebookMessageParams) {
  const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Facebook Messenger error: ${JSON.stringify(error)}`)
  }

  return response.json()
}
