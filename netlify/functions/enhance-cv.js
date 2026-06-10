exports.handler = async (event) => {
  const { cvData, jobDescription } = JSON.parse(event.body);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Your prompt here...` }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  return { statusCode: 200, body: JSON.stringify(data) };
};