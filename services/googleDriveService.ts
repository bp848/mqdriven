// Google Drive MCP integration service

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  webViewLink?: string;
}

export interface GoogleDriveSearchResult {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

class GoogleDriveService {
  private async callMCP(method: string, params: any = {}): Promise<any> {
    try {
      // This would integrate with the Google Drive MCP server
      // For now, we'll simulate the response
      if (method === 'search') {
        return this.mockSearchResults(params.query);
      }
      if (method === 'download') {
        return this.mockDownloadResult(params.fileId);
      }
      throw new Error(`Unknown method: ${method}`);
    } catch (error) {
      console.error('Google Drive MCP error:', error);
      throw error;
    }
  }

  private mockSearchResults(query: string): GoogleDriveSearchResult {
    const mockFiles: GoogleDriveFile[] = [
      {
        id: '1mockExcelFileId',
        name: '交通費精算_2024年1月.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: '15420',
        createdTime: '2024-01-15T10:30:00.000Z',
        webViewLink: 'https://docs.google.com/spreadsheets/d/1mockExcelFileId'
      },
      {
        id: '2mockExcelFileId',
        name: '出張経費_大阪出張.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: '8756',
        createdTime: '2024-01-10T14:20:00.000Z',
        webViewLink: 'https://docs.google.com/spreadsheets/d/2mockExcelFileId'
      },
      {
        id: '3mockImageFileId',
        name: '領収書_新幹線.jpg',
        mimeType: 'image/jpeg',
        size: '245680',
        createdTime: '2024-01-08T09:15:00.000Z'
      }
    ];

    // Filter by query if provided
    const filteredFiles = query 
      ? mockFiles.filter(file => 
          file.name.toLowerCase().includes(query.toLowerCase()) ||
          file.mimeType.includes('sheet') && query.toLowerCase().includes('excel')
        )
      : mockFiles;

    return {
      files: filteredFiles,
      nextPageToken: filteredFiles.length > 0 ? 'mockNextPageToken' : undefined
    };
  }

  private mockDownloadResult(fileId: string): { data: ArrayBuffer; fileName: string } {
    const mockFiles: Record<string, { name: string; content: string }> = {
      '1mockExcelFileId': {
        name: '交通費精算_2024年1月.xlsx',
        content: 'mock excel content'
      },
      '2mockExcelFileId': {
        name: '出張経費_大阪出張.xlsx',
        content: 'mock excel content'
      },
      '3mockImageFileId': {
        name: '領収書_新幹線.jpg',
        content: 'mock image content'
      }
    };

    const file = mockFiles[fileId];
    if (!file) {
      throw new Error('File not found');
    }

    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(file.content).buffer;

    return {
      data,
      fileName: file.name
    };
  }

  async searchFiles(query?: string): Promise<GoogleDriveSearchResult> {
    return this.callMCP('search', { query });
  }

  async downloadFile(fileId: string): Promise<{ data: ArrayBuffer; fileName: string }> {
    return this.callMCP('download', { fileId });
  }

  async searchExpenseFiles(): Promise<GoogleDriveSearchResult> {
    // Search for common expense-related file names and types
    const searchQueries = [
      '交通費',
      '精算',
      '経費',
      '出張',
      '領収書',
      'expense'
    ];

    const allFiles: GoogleDriveFile[] = [];
    
    for (const query of searchQueries) {
      try {
        const result = await this.searchFiles(query);
        allFiles.push(...result.files);
      } catch (error) {
        console.warn(`Failed to search for ${query}:`, error);
      }
    }

    // Remove duplicates
    const uniqueFiles = allFiles.filter((file, index, self) => 
      index === self.findIndex(f => f.id === file.id)
    );

    return {
      files: uniqueFiles
    };
  }

  isExcelFile(file: GoogleDriveFile): boolean {
    return file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
           file.mimeType === 'application/vnd.ms-excel' ||
           file.name.toLowerCase().endsWith('.xlsx') ||
           file.name.toLowerCase().endsWith('.xls');
  }

  isImageFile(file: GoogleDriveFile): boolean {
    return file.mimeType.startsWith('image/') ||
           !!file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/i);
  }

  filterExpenseFiles(files: GoogleDriveFile[]): GoogleDriveFile[] {
    return files.filter(file => 
      this.isExcelFile(file) || this.isImageFile(file)
    );
  }
}

export const googleDriveService = new GoogleDriveService();
