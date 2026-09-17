import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient | null = null;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      '';
    this.bucket = this.configService.get<string>('SUPABASE_BUCKET') || 'school-erp-vault';

    if (supabaseUrl && !supabaseUrl.includes('your-project-id')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.logger.log(`Initialized Supabase Storage client for bucket: ${this.bucket}`);
      } catch (err) {
        this.logger.warn(`Failed to connect to Supabase Storage: ${err?.message}`);
      }
    } else {
      this.logger.log('StorageService running with local/mock fallback storage');
    }
  }

  async uploadFile(
    schoolId: string,
    folder: string,
    filename: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const filePath = `${schoolId}/${folder}/${Date.now()}-${filename}`;

    if (this.supabase) {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .upload(filePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        this.logger.error(`Supabase upload error: ${error.message}`);
        return `/storage-mock/${filePath}`;
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    }

    return `/storage-mock/${filePath}`;
  }

  async getFileUrl(schoolId: string, path: string): Promise<string> {
    if (this.supabase) {
      const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(`${schoolId}/${path}`);
      return data.publicUrl;
    }
    return `/storage-mock/${schoolId}/${path}`;
  }
}
