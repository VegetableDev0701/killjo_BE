const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

class MinioService {
  constructor() {
    this.client = null;
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'nodo-listings';
    this.isInitialized = false;
    this.isInitializing = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    if (this.isInitializing) {
      // Wait for ongoing initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;
    console.log('Initializing MinIO service...');
    console.log(process.env.MINIO_PUBLIC_ENDPOINT);
    console.log(process.env.MINIO_ROOT_USER);
    console.log(process.env.MINIO_ROOT_PASSWORD);

    try {
      this.client = new S3Client({
        region: 'us-east-1', // MinIO ignores region but it's required
        endpoint: process.env.MINIO_PUBLIC_ENDPOINT, // Railway MinIO endpoint
        credentials: {
          accessKeyId: process.env.MINIO_ROOT_USER,
          secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
        },
        forcePathStyle: true, // Required for MinIO
      });

      // Create bucket if it doesn't exist
      try {
        const createBucketCommand = new CreateBucketCommand({
          Bucket: this.bucketName
        });
        await this.client.send(createBucketCommand);
        console.log(`✅ Created bucket '${this.bucketName}'`);
      } catch (error) {
        if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
          console.log(`✅ Bucket '${this.bucketName}' already exists`);
        } else {
          console.log(`⚠️ Could not create bucket: ${error.message}`);
        }
      }

      // Test connection by listing objects
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          MaxKeys: 1
        });
        await this.client.send(listCommand);
        console.log(`✅ Connected to bucket '${this.bucketName}' successfully`);
      } catch (error) {
        console.error(`❌ Error connecting to bucket: ${error.message}`);
        throw error;
      }

      this.isInitialized = true;
      console.log('MinIO service initialized successfully');
      // Ensure public read policy is set
      await this.configureBucketPolicy();
    } catch (error) {
      console.error('Error initializing MinIO service:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async configureBucketPolicy() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Configure bucket policy for public read access
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${this.bucketName}/*`
          }
        ]
      };

      const putBucketPolicyCommand = new PutBucketPolicyCommand({
        Bucket: this.bucketName,
        Policy: JSON.stringify(bucketPolicy)
      });

      await this.client.send(putBucketPolicyCommand);
      console.log(`✅ Configured public read policy for bucket '${this.bucketName}'`);
    } catch (error) {
      console.warn(`⚠️ Could not configure bucket policy: ${error.message}`);
    }
  }

  async uploadImage(file, folder = 'images') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const fileName = `${folder}/${uuidv4()}${fileExtension}`;

      // Process image with Sharp (only if it's a real image)
      let processedBuffer;
      try {
        processedBuffer = await this.processImage(file.buffer || file.path, fileExtension);
      } catch (processError) {
        console.warn(`⚠️ Image processing failed, using original: ${processError.message}`);
        // If processing fails, use the original file
        if (file.buffer) {
          processedBuffer = file.buffer;
        } else if (file.path) {
          processedBuffer = require('fs').readFileSync(file.path);
        } else {
          throw new Error('No file content available');
        }
      }

      // Upload to MinIO using AWS SDK
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: processedBuffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000', // 1 year cache
        ACL: 'public-read' // Make object publicly readable
      });

      await this.client.send(uploadCommand);

      // Generate public URL
      const publicUrl = await this.getPublicUrl(fileName);

      return {
        fileName,
        publicUrl,
        size: processedBuffer.length,
        originalName: file.originalname
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async uploadMultipleImages(files, folder = 'images') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const uploadPromises = files.map(file => this.uploadImage(file, folder));

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  }

  async uploadFile(buffer, fileName, contentType = 'application/pdf', folder = 'reports') {
    if (!this.isInitialized) await this.initialize();

    try {
      const objectName = `${folder}/${fileName}`;
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectName,
        Body: buffer,
        ContentType: contentType
      });

      await this.client.send(command);
      return objectName; // Return the key/path
    } catch (error) {
      console.error('Error uploading file to MinIO:', error);
      throw error;
    }
  }

  async processImage(buffer, extension) {
    try {
      let sharpInstance = sharp(buffer);

      // Resize and optimize based on file type
      if (['.jpg', '.jpeg'].includes(extension)) {
        sharpInstance = sharpInstance
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true
          });
      } else if (extension === '.png') {
        sharpInstance = sharpInstance
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({
            quality: 85,
            progressive: true
          });
      } else if (extension === '.webp') {
        sharpInstance = sharpInstance
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({
            quality: 85
          });
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      console.error('Error processing image:', error);
      // Return original buffer if processing fails
      return buffer;
    }
  }

  async getPublicUrl(fileName) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate direct public URL (no expiration)
      const publicUrl = `${process.env.MINIO_PUBLIC_ENDPOINT}/${this.bucketName}/${fileName}`;
      return publicUrl;
    } catch (error) {
      console.error('Error generating public URL:', error);
      throw error;
    }
  }

  async getPresignedUrl(fileName, expiresIn = 604800) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate presigned URL with custom expiration (max 7 days for AWS S3)
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName
      });

      const url = await getSignedUrl(this.client, getCommand, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  async deleteImage(publicImageUrl) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const url = new URL(publicImageUrl);// url.pathname => "/bucketName/listings/abc123.jpg"
      const pathParts = url.pathname.split("/");// ["", "bucketName", "listings", "abc123.jpg"]
      const fileName = pathParts.slice(2).join("/");// "listings/abc123.jpg"

      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName
      });

      await this.client.send(deleteCommand);
      console.log(`Image ${fileName} deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  async deleteMultipleImages(fileNames) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const deletePromises = fileNames.map(fileName => {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: fileName
        });
        return this.client.send(deleteCommand);
      });

      await Promise.all(deletePromises);
      console.log(`${fileNames.length} images deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting multiple images:', error);
      throw error;
    }
  }

  async listImages(prefix = '', limit = 100) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: limit
      });

      const result = await this.client.send(listCommand);
      return result.Contents || [];
    } catch (error) {
      console.error('Error listing images:', error);
      throw error;
    }
  }

  async getImageInfo(fileName) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileName
      });

      const result = await this.client.send(headCommand);
      return {
        fileName,
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      throw error;
    }
  }

  // Generate thumbnail
  async generateThumbnail(buffer, size = 300) {
    try {
      const thumbnail = await sharp(buffer)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      return thumbnail;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  // Get service status
  async getStatus() {
    try {
      if (!this.isInitialized) {
        return { status: 'not_initialized' };
      }

      // Test connection
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1
      });

      await this.client.send(listCommand);

      return {
        status: 'connected',
        bucket: this.bucketName,
        endpoint: process.env.MINIO_PUBLIC_ENDPOINT
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        bucket: this.bucketName,
        endpoint: process.env.MINIO_PUBLIC_ENDPOINT
      };
    }
  }
}

// Export singleton instance
module.exports = new MinioService(); 