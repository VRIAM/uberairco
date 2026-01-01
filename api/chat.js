// Vercel Serverless Function - z.ai API Proxy
// This proxies requests to z.ai API to avoid CORS issues and hide API key

module.exports = async function handler(req, res) {
    // CORS headers for browser requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the messages from the request body
    const { messages, model, temperature } = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Z.AI API configuration
    const ZAI_KEY = "dd103b6b8df24db8b5c112e30198edff.2qmbRGko3oflbXkq";
    const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";

    try {
        const requestBody = {
            model: model || 'glm-4.5-air',  // Use Air model for faster responses
            messages: messages,
            temperature: temperature || 0.7,
            stream: false  // Explicitly disable streaming
        };

        console.log('Calling z.ai API:', ZAI_ENDPOINT);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

        try {
            // Call z.ai API with Bearer authentication and timeout
            const response = await fetch(ZAI_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ZAI_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('z.ai response status:', response.status);

            // Check if the response is ok
            if (!response.ok) {
                const errorText = await response.text();
                console.error('z.ai API Error:', response.status, errorText);
                return res.status(500).json({
                    error: `z.ai API Error: ${response.status}`,
                    details: errorText,
                    endpoint: ZAI_ENDPOINT
                });
            }

            // Parse and return the response
            const data = await response.json();
            console.log('z.ai response received successfully');
            return res.status(200).json(data);

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                console.error('Request timeout after 25 seconds');
                return res.status(504).json({
                    error: 'Request timeout',
                    message: 'z.ai API took too long to respond (>25s). Please try again.'
                });
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
