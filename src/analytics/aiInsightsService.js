const OpenAI = require('openai');
const logger = require('../utils/logger');

class AiInsightsService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateInsights(analyticsData, period, language = 'en') {
        try {
            const prompt = this._buildPrompt(analyticsData, period, language);

            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "system", content: "You are a business analytics expert." }, { role: "user", content: prompt }],
                model: "gpt-4o-mini", // Optimized for speed and cost
                response_format: { type: "json_object" },
            });

            const content = completion.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            logger.error('Error generating AI insights:', error);
            // Return fallback/empty data on error to allow report generation to proceed
            return this._getFallbackInsights(language);
        }
    }

    _buildPrompt(data, period, language) {
        const langInstruction = language === 'es' ? 'RESPOND IN SPANISH.' : 'RESPOND IN ENGLISH.';

        return `
        Analyze the following e-commerce analytics data for the last ${period} days.
        ${safeStringify(data)}
        
        ${langInstruction}
        
        Provide two sections:
        1. "insights": A html paragraph highlighting key trends (growth, drops, anomalies). Try keeping it less than 10 lines.
        2. "opportunities": A html paragraph suggesting actions for sellers based on the data. Try keeping it less than 10 lines.
        
        Return ONLY a JSON object with keys "insights" and "opportunities".
        Example format:
        {
            "insights": "<p>Your insights here...</p>",
            "opportunities": "<p>Your opportunities here...</p>"
        }
        Keep the HTML simple (p, b tags).
        `;
    }

    _getFallbackInsights(language) {
        if (language === 'es') {
            return {
                insights: "<p>No hay insights disponibles en este momento due to technical difficulties.</p>",
                opportunities: "<p>No hay oportunidades disponibles en este momento.</p>"
            };
        }
        return {
            insights: "<p>Insights are currently unavailable due to technical difficulties.</p>",
            opportunities: "<p>Opportunities are currently unavailable.</p>"
        };
    }
}

function safeStringify(data) {
    // Simple helper to avoid circular structures if any, though analytics data should be clean.
    try {
        return JSON.stringify(data, null, 2);
    } catch (e) {
        return "Data too complex to stringify";
    }
}

module.exports = new AiInsightsService();
