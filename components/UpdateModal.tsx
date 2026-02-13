import React, { useState, useEffect } from 'react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">🚀 システム更新のお知らせ</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>以下の機能が更新されました：</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>サイドナビの視認性を改善</li>
              <li>モバイル表示の最適化</li>
              <li>管理者機能の強化</li>
              <li>ユーザー管理画面の改善</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              更新日時: {new Date().toLocaleDateString('ja-JP')}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
