import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertTriangle, CheckCircle } from '../Icons.tsx';
import { Toast } from '../../types.ts';
import { uploadFile } from '../../services/dataService.ts';
import { hasSupabaseCredentials } from '../../services/supabaseClient.ts';
import { googleDriveService, GoogleDriveFile } from '../../services/googleDriveService.ts';

interface ExpenseManagementProps {
  addToast: (message: string, type: Toast['type']) => void;
  isAIOff: boolean;
}

interface ExpenseRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  receipt?: string;
  status: 'pending' | 'approved' | 'rejected';
}

const ExpenseManagement: React.FC<ExpenseManagementProps> = ({ addToast, isAIOff }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState<{ name: string; url: string }[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSupabaseConfigured = hasSupabaseCredentials();

  // Google Drive states
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingGoogleDrive, setIsLoadingGoogleDrive] = useState(false);
  const [selectedGoogleDriveFiles, setSelectedGoogleDriveFiles] = useState<string[]>([]);
  
  // Manual input states
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualExpenses, setManualExpenses] = useState<ExpenseRecord[]>([]);

  // Excel file handling
  const isExcel = (file: File) => 
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.toLowerCase().endsWith('.xlsx') ||
    file.name.toLowerCase().endsWith('.xls');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file: File) => 
      isExcel(file) || file.type.startsWith('image/')
    );
    
    if (droppedFiles.length === 0) {
      setError('Excelファイルまたは画像ファイル（領収書）をアップロードしてください');
      return;
    }
    
    setFiles(prev => [...prev, ...droppedFiles]);
    setError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter((file: File) => 
      isExcel(file) || file.type.startsWith('image/')
    );
    
    if (selectedFiles.length === 0) {
      setError('Excelファイルまたは画像ファイル（領収書）をアップロードしてください');
      return;
    }
    
    setFiles(prev => [...prev, ...selectedFiles]);
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processExcelFile = async (file: File): Promise<ExpenseRecord[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        // Excel processing logic would go here
        // For now, return mock data
        const mockExpenses: ExpenseRecord[] = [
          {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            category: '交通費',
            amount: 2500,
            description: '新宿〜大阪 新幹線代',
            status: 'pending'
          },
          {
            id: (Date.now() + 1).toString(),
            date: new Date().toISOString().split('T')[0],
            category: '宿泊費',
            amount: 12000,
            description: '大阪ホテル宿泊費',
            status: 'pending'
          }
        ];
        resolve(mockExpenses);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const uploadFiles = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabaseの設定が必要です');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const uploadPromises = files.map(async (file) => {
        const result = await uploadFile(file);
        return { name: file.name, url: result.publicUrl || result.path };
      });

      const results = await Promise.all(uploadPromises);
      setUploaded(results);

      // Process Excel files and extract expense data
      const excelFiles = files.filter(isExcel);
      if (excelFiles.length > 0) {
        setIsProcessing(true);
        for (const excelFile of excelFiles) {
          const expenses = await processExcelFile(excelFile);
          setExpenses(prev => [...prev, ...expenses]);
        }
        setIsProcessing(false);
      }

      addToast(`${files.length}個のファイルをアップロードしました`, 'success');
      setFiles([]);
    } catch (err) {
      setError('ファイルのアップロードに失敗しました');
      addToast('アップロードに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const importFromGoogleDrive = async () => {
    setShowGoogleDriveModal(true);
    setIsLoadingGoogleDrive(true);
    setError('');
    
    try {
      const expenseFiles = await googleDriveService.searchExpenseFiles();
      setGoogleDriveFiles(expenseFiles.files);
    } catch (err) {
      setError('Google Driveのファイル取得に失敗しました');
      addToast('Google Drive接続に失敗しました', 'error');
    } finally {
      setIsLoadingGoogleDrive(false);
    }
  };

  const toggleGoogleDriveFileSelection = (fileId: string) => {
    setSelectedGoogleDriveFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const importSelectedGoogleDriveFiles = async () => {
    if (selectedGoogleDriveFiles.length === 0) {
      setError('ファイルを選択してください');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      for (const fileId of selectedGoogleDriveFiles) {
        const { data, fileName } = await googleDriveService.downloadFile(fileId);
        
        // Create File object from ArrayBuffer
        const mimeType = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'image/jpeg';
        
        const file = new File([data], fileName, { type: mimeType });
        
        // Upload to Supabase
        const result = await uploadFile(file);
        setUploaded(prev => [...prev, { name: fileName, url: result.publicUrl || result.path }]);

        // Process Excel files
        if (isExcel(file)) {
          setIsProcessing(true);
          const expenses = await processExcelFile(file);
          setExpenses(prev => [...prev, ...expenses]);
          setIsProcessing(false);
        }
      }

      addToast(`${selectedGoogleDriveFiles.length}個のファイルをGoogle Driveからインポートしました`, 'success');
      setShowGoogleDriveModal(false);
      setSelectedGoogleDriveFiles([]);
    } catch (err) {
      setError('Google Driveからのファイルインポートに失敗しました');
      addToast('インポートに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const updateExpenseStatus = (id: string, status: ExpenseRecord['status']) => {
    setExpenses(prev => prev.map(expense => 
      expense.id === id ? { ...expense, status } : expense
    ));
    addToast('経費のステータスを更新しました', 'success');
  };

  const parseClipboardData = (text: string): ExpenseRecord[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const expenses: ExpenseRecord[] = [];
    
    lines.forEach((line, index) => {
      // Try to parse as tab-separated or comma-separated values
      const values = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
      
      if (values.length >= 3) {
        // Try to extract date, amount, and description
        const date = values[0]?.trim() || new Date().toISOString().split('T')[0];
        const amountStr = values[1]?.trim().replace(/[¥,]/g, '') || '0';
        const amount = parseFloat(amountStr) || 0;
        const description = values.slice(2).join(',').trim() || '経費';
        
        if (amount > 0) {
          expenses.push({
            id: `manual-${Date.now()}-${index}`,
            date,
            category: '交通費',
            amount,
            description,
            status: 'pending'
          });
        }
      }
    });
    
    return expenses;
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    
    if (!text.trim()) {
      setError('クリップボードにデータがありません');
      return;
    }
    
    try {
      const parsedExpenses = parseClipboardData(text);
      
      if (parsedExpenses.length === 0) {
        setError('クリップボードデータから経費情報を解析できませんでした');
        return;
      }
      
      setManualExpenses(prev => [...prev, ...parsedExpenses]);
      setShowManualInput(true);
      addToast(`${parsedExpenses.length}件の経費データをクリップボードから読み込みました`, 'success');
    } catch (err) {
      setError('クリップボードデータの解析に失敗しました');
      addToast('データ解析に失敗しました', 'error');
    }
  };

  const addManualExpense = () => {
    const newExpense: ExpenseRecord = {
      id: `manual-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category: '交通費',
      amount: 0,
      description: '',
      status: 'pending'
    };
    setManualExpenses(prev => [...prev, newExpense]);
    setShowManualInput(true);
  };

  const updateManualExpense = (id: string, field: keyof ExpenseRecord, value: any) => {
    setManualExpenses(prev => prev.map(expense => 
      expense.id === id ? { ...expense, [field]: value } : expense
    ));
  };

  const removeManualExpense = (id: string) => {
    setManualExpenses(prev => prev.filter(expense => expense.id !== id));
  };

  const saveManualExpenses = () => {
    const validExpenses = manualExpenses.filter(expense => 
      expense.amount > 0 && expense.description.trim()
    );
    
    if (validExpenses.length === 0) {
      setError('有効な経費データがありません');
      return;
    }
    
    setExpenses(prev => [...prev, ...validExpenses]);
    setManualExpenses([]);
    setShowManualInput(false);
    addToast(`${validExpenses.length}件の経費データを保存しました`, 'success');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">交通費精算管理</h1>
        <p className="text-gray-600">Excelファイルや領収書をアップロードして経費精算を処理します</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">ファイルアップロード</h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">
            Excelファイルまたは領収書画像をドラッグ＆ドロップ
          </p>
          <p className="text-sm text-gray-500 mb-4">
            (.xlsx, .xls, .jpg, .png)
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            ファイルを選択
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Google Drive Import */}
        <div className="mt-4 flex gap-4">
          <button
            onClick={importFromGoogleDrive}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
          >
            📁 Google Driveからインポート
          </button>
          <button
            onClick={addManualExpense}
            className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
          >
            ➕ 手動入力
          </button>
        </div>

        {/* Clipboard Paste Area */}
        <div className="mt-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors hover:border-gray-400"
            onPaste={handlePaste}
            tabIndex={0}
            role="textbox"
            contentEditable={false}
          >
            <p className="text-gray-600">
              📋 Excelやスプレッドシートからコピーしたデータをここに貼り付け
            </p>
            <p className="text-sm text-gray-500 mt-1">
              日付\t金額\t説明 の形式で貼り付けると自動で経費データが作成されます
            </p>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">アップロード対象ファイル</h3>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>{file.name}</span>
                    <span className="text-sm text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={uploadFiles}
              disabled={isUploading || !isSupabaseConfigured}
              className="mt-4 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300"
            >
              {isUploading ? 'アップロード中...' : 'アップロード'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Success Display */}
        {uploaded.length > 0 && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-700 font-semibold">アップロード完了</span>
            </div>
            <div className="space-y-1">
              {uploaded.map((file, index) => (
                <div key={index} className="text-sm text-green-600">
                  ✓ {file.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Input Modal */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">経費データ入力</h2>
                <button
                  onClick={() => setShowManualInput(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {manualExpenses.map((expense) => (
                  <div key={expense.id} className="border rounded p-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">日付</label>
                        <input
                          type="date"
                          value={expense.date}
                          onChange={(e) => updateManualExpense(expense.id, 'date', e.target.value)}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">カテゴリ</label>
                        <select
                          value={expense.category}
                          onChange={(e) => updateManualExpense(expense.id, 'category', e.target.value)}
                          className="w-full p-2 border rounded"
                        >
                          <option value="交通費">交通費</option>
                          <option value="宿泊費">宿泊費</option>
                          <option value="食費">食費</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">金額</label>
                        <input
                          type="number"
                          value={expense.amount}
                          onChange={(e) => updateManualExpense(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">説明</label>
                        <input
                          type="text"
                          value={expense.description}
                          onChange={(e) => updateManualExpense(expense.id, 'description', e.target.value)}
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeManualExpense(expense.id)}
                      className="mt-2 text-red-500 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {manualExpenses.length}件の経費データ
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowManualInput(false)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveManualExpenses}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense List */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">精算対象経費</h2>
          {isProcessing && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">Excelファイルを処理中...</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">日付</th>
                  <th className="text-left p-2">カテゴリ</th>
                  <th className="text-left p-2">金額</th>
                  <th className="text-left p-2">説明</th>
                  <th className="text-left p-2">ステータス</th>
                  <th className="text-left p-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b">
                    <td className="p-2">{expense.date}</td>
                    <td className="p-2">{expense.category}</td>
                    <td className="p-2">¥{expense.amount.toLocaleString()}</td>
                    <td className="p-2">{expense.description}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        expense.status === 'approved' ? 'bg-green-100 text-green-700' :
                        expense.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {expense.status === 'approved' ? '承認' :
                         expense.status === 'rejected' ? '却下' : '保留中'}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateExpenseStatus(expense.id, 'approved')}
                          className="text-green-500 hover:text-green-700 text-sm"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => updateExpenseStatus(expense.id, 'rejected')}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          却下
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Google Drive Modal */}
      {showGoogleDriveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Google Driveからファイルを選択</h2>
                <button
                  onClick={() => setShowGoogleDriveModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isLoadingGoogleDrive ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600">Google Driveからファイルを読み込み中...</p>
                </div>
              ) : googleDriveFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">経費関連のファイルが見つかりませんでした</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {googleDriveFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${
                        selectedGoogleDriveFiles.includes(file.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleGoogleDriveFileSelection(file.id)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedGoogleDriveFiles.includes(file.id)}
                          onChange={() => toggleGoogleDriveFileSelection(file.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {file.size && `${(parseInt(file.size) / 1024).toFixed(1)} KB`} • 
                            {new Date(file.createdTime).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          開く
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {selectedGoogleDriveFiles.length}個のファイルを選択中
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowGoogleDriveModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={importSelectedGoogleDriveFiles}
                    disabled={selectedGoogleDriveFiles.length === 0 || isUploading}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-300"
                  >
                    {isUploading ? 'インポート中...' : 'インポート'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagement;
