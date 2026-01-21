"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Download, Send, FileText, Calendar, DollarSign, Eye, Edit, Trash2, Plus, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  // サンプルデータ
  useEffect(() => {
    const sampleData: Estimate[] = [
      {
        id: "1",
        documentNumber: "EST-2025-001",
        documentType: "estimate",
        status: "draft",
        customerName: "株式会社ABC商事",
        customerEmail: "info@abc-corp.jp",
        customerPhone: "03-1234-5678",
        customerAddress: "東京都千代田区丸の内1-1-1",
        subtotal: 100000,
        taxRate: 0.10,
        taxAmount: 10000,
        totalAmount: 110000,
        issueDate: "2025-01-21",
        validUntil: "2025-02-21",
        title: "パンフレット印刷見積",
        content: [
          {
            id: "1",
            itemName: "A4パンフレット",
            description: "フルカラー印刷",
            quantity: 1000,
            unit: "枚",
            unitPrice: 100,
            discountRate: 0,
            subtotal: 100000
          }
        ],
        notes: "納期：2週間",
        emailSentAt: "2025-01-21 10:00",
        emailOpenedAt: "2025-01-21 10:30",
        emailOpenCount: 3,
        createdBy: "山田太郎",
        createdAt: "2025-01-21 09:00",
        updatedAt: "2025-01-21 09:00"
      },
      {
        id: "2",
        documentNumber: "EST-2025-002",
        documentType: "estimate",
        status: "sent",
        customerName: "株式会社XYZ",
        customerEmail: "sales@xyz.co.jp",
        customerPhone: "03-9876-5432",
        customerAddress: "大阪府大阪市中央区1-1-1",
        subtotal: 250000,
        taxRate: 0.10,
        taxAmount: 25000,
        totalAmount: 275000,
        issueDate: "2025-01-20",
        validUntil: "2025-02-20",
        title: "名刺印刷見積",
        content: [
          {
            id: "1",
            itemName: "名刺",
            description: "フルカラー両面印刷",
            quantity: 500,
            unit: "枚",
            unitPrice: 500,
            discountRate: 0,
            subtotal: 250000
          }
        ],
        notes: "デザインデータお持ちの場合は割引",
        emailSentAt: "2025-01-20 14:00",
        emailOpenedAt: "2025-01-20 14:45",
        emailOpenCount: 1,
        createdBy: "鈴木花子",
        createdAt: "2025-01-20 13:00",
        updatedAt: "2025-01-20 13:00"
      }
    ]
    setEstimates(sampleData)
    setFilteredEstimates(sampleData)
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
