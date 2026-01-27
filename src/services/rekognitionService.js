const AWS = require('aws-sdk');
const axios = require('axios');
require('dotenv').config();

class RekognitionService {
    constructor(region = 'us-east-1') {
        console.log('Initializing RekognitionService');
        console.log(process.env.AWS_REGION);
        console.log(process.env.AWS_ACCESS_KEY_ID);
        console.log(process.env.AWS_SECRET_ACCESS_KEY);
        console.log("----------------------------------");

        this.rekognition = new AWS.Rekognition({
            region: process.env.AWS_REGION || region,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
        
        // Define the categories we want to filter
        this.restrictedCategories = [
            'Explicit Nudity',
            'Suggestive',
            'Partial Nudity',
            'Weapons',
            'Violence',
            'Visually Disturbing',
            'Drugs',
        ];
    }

    async checkImage(imageInput, minConfidence = 50) {
        try {
            let imageBytes;

            // Check if input is a URL or Buffer
            if (typeof imageInput === 'string') {
                // It's a URL, download the image
                const imageResponse = await axios.get(imageInput, {
                    responseType: 'arraybuffer'
                });
                imageBytes = Buffer.from(imageResponse.data);
            } else if (Buffer.isBuffer(imageInput)) {
                // It's already a Buffer
                imageBytes = imageInput;
            } else if (imageInput.buffer) {
                // It's a file object with buffer property (from multer)
                imageBytes = imageInput.buffer;
            } else {
                throw new Error('Invalid image input. Must be URL string or Buffer.');
            }

            const params = {
                Image: {
                    Bytes: imageBytes
                },
                MinConfidence: minConfidence
            };

            const result = await this.rekognition.detectModerationLabels(params).promise();

            // Filter only the categories we care about
            const filteredLabels = result.ModerationLabels.filter(label => 
                this.restrictedCategories.includes(label.Name) || 
                this.restrictedCategories.includes(label.ParentName)
            );

            // Return simple response
            if (filteredLabels.length === 0) {
                return {
                    isContentSafe: true,
                    rejectedFor: null
                };
            }

            // Get the highest confidence rejected category
            const highestConfidenceLabel = filteredLabels.reduce((max, label) => 
                label.Confidence > max.Confidence ? label : max
            );

            return {
                isContentSafe: false,
                rejectedFor: highestConfidenceLabel.Name,
                confidence: highestConfidenceLabel.Confidence
            };
        } catch (error) {
            // Handle AWS Rekognition errors
            if (error.code) {
                console.log(`AWS Rekognition Error: ${error.code} - ${error.message}`);
                throw new Error(`AWS Rekognition Error: ${error.code} - ${error.message}`);
            } else if (error.response) {
                console.log(`Image download error: ${error.response.status}`);
                throw new Error(`Image download error: ${error.response.status}`);
            } else {
                console.log(`Network Error: ${error.message}`);
                throw new Error(`Network Error: ${error.message}`);
            }
        }
    }

    // Check multiple images in parallel
    async checkMultipleImages(files, minConfidence = 50) {
        try {
            const checks = files.map(async (file, index) => {
                try {
                    const result = await this.checkImage(file, minConfidence);
                    return {
                        index,
                        fileName: file.originalname || `file_${index}`,
                        result,
                        success: true
                    };
                } catch (error) {
                    console.error(`Error checking image ${file.originalname || `file_${index}`}:`, error);
                    return {
                        index,
                        fileName: file.originalname || `file_${index}`,
                        result: {
                            isContentSafe: false,
                            rejectedFor: 'Processing Error',
                            confidence: 100
                        },
                        success: false,
                        error: error.message
                    };
                }
            });

            const results = await Promise.all(checks);
            return results;
        } catch (error) {
            console.error('Error checking multiple images:', error);
            throw error;
        }
    }
}

module.exports = new RekognitionService();