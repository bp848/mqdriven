import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle } from '../Icons';

interface EmailStatus {
  isOpened: boolean;
  openedAt: string | null;
  openCount: number;
}

interface EmailStatusIndicatorProps {
  emailId?: string;
  sentAt: string;
  recipientEmail: string;
}

export const EmailStatusIndicator: React.FC<EmailStatusIndicatorProps> = ({
  emailId,
  sentAt,
  recipientEmail
}) => {
  const [status, setStatus] = useState<EmailStatus>({
    isOpened: false,
    openedAt: null,
    openCount: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  // Function to check email status
  const checkEmailStatus = async () => {
    if (!emailId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${window.location.origin}/api/tracking/status/${emailId}`);
      if (response.ok) {
        const emailStatus: EmailStatus = await response.json();
        setStatus(emailStatus);
      }
    } catch (error) {
      console.error('Error checking email status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check status on mount and periodically
  useEffect(() => {
    if (emailId) {
      checkEmailStatus();
      
      // Check every 30 seconds for the first 5 minutes, then every 5 minutes
      const interval = setInterval(() => {
        checkEmailStatus();
      }, 30000);
      
      // Clear interval after 5 minutes
      const timeout = setTimeout(() => {
        clearInterval(interval);
        const longInterval = setInterval(checkEmailStatus, 300000); // 5 minutes
        return () => clearInterval(longInterval);
      }, 300000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [emailId]);

  if (!emailId) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Mail className="w-3 h-3" />
        <span>メール未送信</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {isLoading ? (
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
      ) : (
        <div className={`w-2 h-2 rounded-full ${
          status.isOpened ? 'bg-green-500' : 'bg-gray-300'
        }`} />
      )}
      
      <span className="text-slate-600">
        {status.isOpened ? 
          `開封済 (${status.openedAt ? new Date(status.openedAt).toLocaleString('ja-JP', { 
            month: 'numeric', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : '時刻不明'})` : 
          '未開封'
        }
      </span>
      
      {status.openCount > 1 && (
        <span className="text-amber-600 font-medium">
          ({status.openCount}回)
        </span>
      )}
      
      <button
        onClick={checkEmailStatus}
        className="text-blue-600 hover:text-blue-800 underline"
        title="開封状況を再確認"
      >
        再確認
      </button>
    </div>
  );
};
