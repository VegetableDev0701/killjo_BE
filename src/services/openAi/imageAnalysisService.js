const axios = require('axios');

class ImageAnalysisService {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1';
        this.model = 'gpt-4o-mini'; // Latest GPT-4 model with vision capabilities
        
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required');
        }
    }

    /**
     * Analyze image and generate product title and description
     * @param {Buffer|string} imageData - Image buffer or base64 string
     * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg', 'image/png')
     * @param {string} customPrompt - Optional custom prompt for specific analysis
     * @returns {Promise<{title: string, description: string}>} - Generated title and description
     */
    async generateProductInfo(imageData, mimeType, customPrompt = null, country = 'US') {
        try {
            // Convert buffer to base64 if needed
            let base64Image;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else {
                base64Image = imageData;
            }

            const defaultPrompt = `Analyze this product image and generate:
1. A concise, marketable product title (maximum 50 characters)
2. A detailed product description (100-200 words) that includes:
   - Key features and characteristics visible in the image
   - Material, color, size indications if apparent
   - Potential use cases or benefits
   - Professional, sales-oriented language
3. title and description **MUST** be in ${(country ==='US')? 'English': 'Spanish'} language.
Example format:
{
    "title": <"Product Title in PLAIN text, max 50 chars">,
    "description": <"Detailed product description in PLAIN text, 100-200 words">
}
IMPORTANT: Return ONLY a valid JSON object with a 'title' and a 'description' field. Do not use markdown formatting, code blocks, or any other text. Just the raw JSON object.`;

            const prompt = customPrompt || defaultPrompt;

            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: this.model,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: prompt
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Image}`,
                                        detail: "high"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;
            
            // Clean the content by removing markdown code blocks if present
            let cleanedContent = content.trim();
            if (cleanedContent.startsWith('```json')) {
                cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedContent.startsWith('```')) {
                cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            // Try to parse as JSON first
            try {
                const parsed = JSON.parse(cleanedContent);
                if (parsed.title && parsed.description) {
                    return {
                        title: parsed.title.trim(),
                        description: parsed.description.trim()
                    };
                }
            } catch (parseError) {
                // If JSON parsing fails, try to extract title and description from text
                console.log('JSON parsing failed, attempting text extraction from:', cleanedContent);
            }

            // Fallback: Extract from text response
            return this.extractFromTextResponse(cleanedContent);

        } catch (error) {
            console.error('Error in OpenAI image analysis:', error.response?.data || error.message);
            throw new Error(`Image analysis failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Extract title and description from text response when JSON parsing fails
     * @param {string} content - Raw response content
     * @returns {Object} - Extracted title and description
     */
    extractFromTextResponse(content) {
        let title = '';
        let description = '';

        // Try to find title and description patterns
        const titleMatch = content.match(/title[:\s]*["']?([^"'\n]+)["']?/i);
        const descMatch = content.match(/description[:\s]*["']?([^"']+)["']?/i);

        if (titleMatch) {
            title = titleMatch[1].trim();
        } else {
            // Fallback: use first line as title
            const lines = content.split('\n').filter(line => line.trim());
            title = lines[0]?.trim() || 'Product';
        }

        if (descMatch) {
            description = descMatch[1].trim();
        } else {
            // Fallback: use remaining content as description
            const lines = content.split('\n').filter(line => line.trim());
            description = lines.slice(1).join(' ').trim() || content.trim();
        }

        return {
            title: title.substring(0, 60), // Limit title length
            description: description.substring(0, 500) // Limit description length
        };
    }

    /**
     * Analyze multiple images and generate consolidated product info
     * @param {Array} images - Array of {data: Buffer, mimeType: string} objects
     * @param {string} customPrompt - Optional custom prompt
     * @returns {Promise<{title: string, description: string}>} - Generated title and description
     */
    async generateProductInfoFromMultipleImages(images, customPrompt = null) {
        try {
            if (!images || images.length === 0) {
                throw new Error('No images provided');
            }

            // For multiple images, we'll analyze the first one and mention it's part of a set
            const firstImage = images[0];
            const multiImagePrompt = customPrompt || `Analyze this product image (part of a ${images.length}-image set) and generate:
1. A concise, marketable product title (maximum 60 characters)
2. A detailed product description (100-200 words) mentioning this is one of multiple product images

Format as JSON with 'title' and 'description' fields.`;

            return await this.generateProductInfo(firstImage.data, firstImage.mimeType, multiImagePrompt);
        } catch (error) {
            console.error('Error analyzing multiple images:', error);
            throw error;
        }
    }
}

module.exports = ImageAnalysisService;