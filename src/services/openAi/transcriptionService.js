

const OpenAI = require('openai');
const fs = require("fs");
const path = require("path");
const os = require("os");

// Instantiate OpenAI client
let openaiInstance = null;

class TranscriptionService {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1';

        if (!this.apiKey) {
            throw new Error('OpenAI API key is required');
        }

        // Instantiate OpenAI client once
        if (!openaiInstance) {
            openaiInstance = new OpenAI({ apiKey: this.apiKey });
        }
        this.openai = openaiInstance;

        this.supportedFormats = [
            'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'
        ];

        this.models = {
            WHISPER_1: 'whisper-1',
            GPT_4o_mini: 'gpt-4o-mini-transcribe',
            GPT_4o: 'gpt-4o-transcribe'
        };
    }

    /**
     * Transcribe audio file to text
     * @param {string|Buffer} audioFile - Path to audio file or Buffer containing audio data
     * @param {Object} options - Transcription options
     * @param {string} options.model - Whisper model to use (default: whisper-1)
     * @param {string} options.language - Language code (ISO-639-1) for the audio (optional)
     * @param {string} options.prompt - Optional text to guide the model's style
     * @param {string} options.response_format - Response format: json, text, srt, verbose_json, vtt
     * @param {number} options.temperature - Sampling temperature (0 to 1)
     * @returns {Promise<Object>} Transcription result
     */
    async transcribeAudio(audioFile, options = {}) {
        try {


            const tempFilePath = path.join(os.tmpdir(), `transcription-${Date.now()}-${Math.random().toString(36).substring(2, 15)}${audioFile.originalname || 'audio.mp3'}`);
            fs.writeFileSync(tempFilePath, audioFile.buffer);

            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: this.models.WHISPER_1,
                response_format: "json",
            });


            fs.unlinkSync(tempFilePath);


            return this.formatResponse(transcription, options.response_format || 'json');


        } catch (error) {
            console.error('Error transcribing audio:', error.response?.data || error.message);

            // Handle specific OpenAI errors
            if (error.response?.status === 413) {
                throw new Error('Audio file is too large. Maximum size is 25MB.');
            } else if (error.response?.status === 400) {
                throw new Error('Invalid audio file or parameters');
            } else if (error.response?.status === 401) {
                throw new Error('Invalid OpenAI API key');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }

            throw new Error(`Transcription failed: ${error.message}`);
        }
    }


    /**
     * Format the response based on the requested format
     * @param {Object} data - Raw API response data
     * @param {string} format - Requested response format
     * @returns {Object} Formatted response
     */
    formatResponse(data, format) {
        const response = {
            success: true,
            format: format,
            timestamp: new Date().toISOString()
        };

        switch (format) {
            case 'json':
                response.text = data.text;
                break;
            case 'verbose_json':
                response.data = data;
                response.text = data.text;
                response.language = data.language;
                response.duration = data.duration;
                response.segments = data.segments;
                break;
            case 'text':
            case 'srt':
            case 'vtt':
                response.content = data;
                break;
            default:
                response.data = data;
        }

        return response;
    }

    /**
     * Get MIME type for audio file extension
     * @param {string} extension - File extension without dot
     * @returns {string} MIME type
     */
    getMimeType(extension) {
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'mp4': 'audio/mp4',
            'mpeg': 'audio/mpeg',
            'mpga': 'audio/mpeg',
            'm4a': 'audio/mp4',
            'wav': 'audio/wav',
            'webm': 'audio/webm'
        };

        return mimeTypes[extension] || 'audio/mpeg';
    }


}

module.exports = TranscriptionService;
