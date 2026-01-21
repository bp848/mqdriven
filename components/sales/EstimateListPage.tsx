"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Download, Send, FileText, Calendar, DollarSign, Eye, Edit, Trash2, Plus, CheckCircle, TrendingUp, Users, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createSupabaseBrowser } from '../../lib/supabase';
import { generateLeadProposalPackage } from '../../services/geminiService';
import { saveEstimateToManagement } from '../../services/estimateManagementService';

// 型定義
interface EstimateItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  subtotal: number;
}

interface Estimate {
  id: string;
  documentNumber: string;
  documentType: 'estimate' | 'invoice';
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'paid' | 'overdue';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  title: string;
  content: EstimateItem[];
  notes: string;
  emailSentAt?: string;
  emailOpenedAt?: string;
  emailOpenCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function EstimateListPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [filteredEstimates, setFilteredEstimates] = useState<Estimate[]>([])
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("list")

  // 見積もりデータを再取得する関数
  const fetchEstimates = async () => {
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .from('estimate_invoices')
        .select('*')
        .eq('document_type', 'estimate')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('見積もり取得エラー:', error);
        // エラー時は空の配列を表示
        setEstimates([]);
        setFilteredEstimates([]);
      } else {
        // データベースのデータをEstimate型に変換
        const formattedEstimates: Estimate[] = data.map(item => ({
          id: item.id,
          documentNumber: item.document_number,
          documentType: item.document_type,
          status: item.status,
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          customerPhone: item.customer_phone,
          customerAddress: item.customer_address,
          subtotal: item.subtotal,
          taxRate: item.tax_rate,
          taxAmount: item.tax_amount,
          totalAmount: item.total_amount,
          issueDate: item.issue_date,
          dueDate: item.due_date,
          validUntil: item.valid_until,
          title: item.title,
          content: item.content || [],
          notes: item.notes,
          emailSentAt: item.email_sent_at,
          emailOpenedAt: item.email_opened_at,
          emailOpenCount: item.email_open_count || 0,
          createdBy: item.created_by,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }));
        setEstimates(formattedEstimates);
        setFilteredEstimates(formattedEstimates);
      }
    } catch (error) {
      console.error('見積もり取得エラー:', error);
      setEstimates([]);
      setFilteredEstimates([]);
    }
  };

  // データベースから見積もりデータを取得
  useEffect(() => {
    fetchEstimates();
  }, [])

  // フィルター処理
  useEffect(() => {
    let filtered = estimates
    
    if (searchTerm) {
      filtered = filtered.filter(estimate => 
        estimate.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        estimate.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(estimate => estimate.status === statusFilter)
    }
    
    setFilteredEstimates(filtered)
  }, [estimates, searchTerm, statusFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800"
      case "sent": return "bg-blue-100 text-blue-800"
      case "accepted": return "bg-green-100 text-green-800"
      case "rejected": return "bg-red-100 text-red-800"
      case "cancelled": return "bg-yellow-100 text-yellow-800"
      case "paid": return "bg-purple-100 text-purple-800"
      case "overdue": return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft": return "下書き"
      case "sent": return "送付済"
      case "accepted": return "受注済"
      case "rejected": return "却下"
      case "cancelled": return "キャンセル"
      case "paid": return "入金済"
      case "overdue": return "支払遅延"
      default: return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">見積もり管理</h1>
            <div className="flex items-center gap-4">
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新規見積作成
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow rounded-lg">
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                検索・フィルター
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="顧客名・見積番号で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="ステータスで絞り込み" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="draft">下書き</SelectItem>
                    <SelectItem value="sent">送付済</SelectItem>
                    <SelectItem value="accepted">受注済</SelectItem>
                    <SelectItem value="rejected">却下</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                    <SelectItem value="paid">入金済</SelectItem>
                    <SelectItem value="overdue">支払遅延</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList>
              <TabsTrigger value="list">一覧</TabsTrigger>
              <TabsTrigger value="analytics">分析</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="mt-0">
              {/* Estimate List */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>見積番号</TableHead>
                      <TableHead>顧客名</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>金額</TableHead>
                      <TableHead>作成日</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstimates.map((estimate) => (
                      <TableRow key={estimate.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{estimate.documentNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{estimate.customerName}</div>
                            <div className="text-sm text-gray-500">{estimate.customerEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(estimate.status)}>
                            {getStatusText(estimate.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{estimate.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>{estimate.issueDate}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {estimate.status === 'draft' && (
                              <Button size="sm" variant="outline">
                                <Edit className="w-3 h-3 mr-1" />
                                編集
                              </Button>
                            )}
                            <Button size="sm" variant="outline">
                              <Eye className="w-3 h-3 mr-1" />
                              詳細
                            </Button>
                            {estimate.status === 'draft' && (
                              <Button size="sm" variant="outline">
                                <Send className="w-3 h-3 mr-1" />
                                送付
                              </Button>
                            )}
                            {estimate.status === 'sent' && (
                              <Button size="sm" variant="outline">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                受注
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-3 h-3 mr-1" />
                              削除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="analytics" className="mt-0">
              {/* Analytics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      見積概要
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">総見積数</span>
                        <span className="text-2xl font-bold">{estimates.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">今月送付</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {estimates.filter(e => e.status === 'sent').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">受注率</span>
                        <span className="text-2xl font-bold text-green-600">
                          {estimates.length > 0 ? 
                            Math.round((estimates.filter(e => e.status === 'accepted').length / estimates.length) * 100) : 0
                          }%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      売上実績
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">今月売上</span>
                        <span className="text-2xl font-bold text-purple-600">
                          ¥{estimates
                            .filter(e => e.status === 'paid')
                            .reduce((sum, e) => sum + e.totalAmount, 0)
                            .toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">平均単価</span>
                        <span className="text-2xl font-bold">
                          ¥{Math.round(
                            estimates
                              .filter(e => e.status === 'paid')
                              .reduce((sum, e) => sum + e.totalAmount, 0) / 
                              estimates
                                .filter(e => e.status === 'paid')
                                .reduce((sum, e) => sum + e.content.length, 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      メール開封率
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">送付済み</span>
                        <span className="text-2xl font-bold">
                          {estimates.filter(e => e.status === 'sent').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">開封済み</span>
                        <span className="text-2xl font-bold text-green-600">
                          {estimates.filter(e => e.emailOpenCount > 0).length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">開封率</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {estimates.filter(e => e.status === 'sent').length > 0 ? 
                            Math.round((estimates.filter(e => e.emailOpenCount > 0).length / estimates.filter(e => e.status === 'sent').length) * 100) : 0
                          }%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
