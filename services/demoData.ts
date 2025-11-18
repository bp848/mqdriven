import {
  AccountItem,
  ApplicationCode,
  ApplicationWithDetails,
  ApprovalRoute,
  BugReport,
  BugReportStatus,
  Customer,
  Department,
  Employee,
  EmployeeUser,
  Estimate,
  EstimateItem,
  EstimateStatus,
  InboxItem,
  InboxItemStatus,
  InventoryItem,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceData,
  Job,
  JobStatus,
  JournalEntry,
  Lead,
  LeadStatus,
  ManufacturingStatus,
  PaymentRecipient,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../types';

export interface DemoDataState {
  jobs: Job[];
  customers: Customer[];
  journalEntries: JournalEntry[];
  accountItems: AccountItem[];
  leads: Lead[];
  approvalRoutes: ApprovalRoute[];
  purchaseOrders: PurchaseOrder[];
  inventoryItems: InventoryItem[];
  employees: Employee[];
  employeeUsers: EmployeeUser[];
  bugReports: BugReport[];
  estimates: Estimate[];
  applications: ApplicationWithDetails[];
  applicationCodes: ApplicationCode[];
  invoices: Invoice[];
  inboxItems: InboxItem[];
  departments: Department[];
  paymentRecipients: PaymentRecipient[];
}

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const createEstimateItems = (items: EstimateItem[]): EstimateItem[] => items.map(item => ({ ...item }));

export const createDemoDataState = (): DemoDataState => {
  const jobs: Job[] = [
    {
      id: 'job-001',
      jobNumber: 20241001,
      clientName: '株式会社ネオプリント',
      title: '秋季キャンペーンチラシ',
      status: JobStatus.InProgress,
      dueDate: '2025-11-05',
      quantity: 15000,
      paperType: 'コート紙 90kg',
      finishing: 'PP加工（グロス）',
      details: 'A4 / 両面フルカラー / 3営業日納期',
      createdAt: '2025-10-05T03:12:00Z',
      price: 580000,
      variableCost: 320000,
      invoiceStatus: InvoiceStatus.Uninvoiced,
      invoicedAt: null,
      paidAt: null,
      readyToInvoice: false,
      invoiceId: null,
      manufacturingStatus: ManufacturingStatus.Printing,
    },
    {
      id: 'job-002',
      jobNumber: 20240921,
      clientName: '有限会社ブルースタジオ',
      title: '会社案内パンフレット改訂',
      status: JobStatus.Pending,
      dueDate: '2025-10-30',
      quantity: 3000,
      paperType: 'マットコート紙 110kg',
      finishing: '箔押し',
      details: 'A4 / 中綴じ12P / 金箔押しロゴ',
      createdAt: '2025-09-21T10:45:00Z',
      price: 780000,
      variableCost: 410000,
      invoiceStatus: InvoiceStatus.Uninvoiced,
      invoicedAt: null,
      paidAt: null,
      readyToInvoice: true,
      invoiceId: null,
      manufacturingStatus: ManufacturingStatus.DataCheck,
    },
    {
      id: 'job-003',
      jobNumber: 20240818,
      clientName: '株式会社リンクス',
      title: '商品カタログ2025',
      status: JobStatus.Completed,
      dueDate: '2025-09-10',
      quantity: 8000,
      paperType: 'アートポスト 180kg',
      finishing: 'PP加工（マット）',
      details: 'A5 / 無線綴じ / 校正2回',
      createdAt: '2025-08-18T08:30:00Z',
      price: 1250000,
      variableCost: 720000,
      invoiceStatus: InvoiceStatus.Invoiced,
      invoicedAt: '2025-09-12T00:00:00Z',
      paidAt: null,
      readyToInvoice: false,
      invoiceId: 'inv-001',
      manufacturingStatus: ManufacturingStatus.Delivered,
    },
  ];

  const customers: Customer[] = [
    {
      id: 'cus-001',
      customerName: '株式会社ネオプリント',
      representative: '山田 太郎',
      phoneNumber: '03-1234-5678',
      address1: '東京都中央区銀座1-2-3',
      companyContent: 'デザイン・広告制作',
      annualSales: '5億円',
      createdAt: '2023-04-01T00:00:00Z',
      websiteUrl: 'https://neoprint.jp',
      customerRank: 'A',
      salesType: '直取引',
      creditLimit: '500万円',
      customerContactInfo: 'sales@neoprint.jp',
    },
    {
      id: 'cus-002',
      customerName: '有限会社ブルースタジオ',
      representative: '佐藤 花子',
      phoneNumber: '06-2345-6789',
      address1: '大阪府大阪市北区梅田2-3-4',
      companyContent: 'クリエイティブスタジオ',
      annualSales: '1.2億円',
      createdAt: '2024-02-14T00:00:00Z',
      websiteUrl: 'https://bluestudio.jp',
      customerRank: 'B',
      salesType: '紹介',
      creditLimit: '200万円',
      customerContactInfo: 'info@bluestudio.jp',
    },
    {
      id: 'cus-003',
      customerName: '株式会社リンクス',
      representative: '田中 実',
      phoneNumber: '052-345-6789',
      address1: '愛知県名古屋市中区栄1-2-3',
      companyContent: '電子機器製造・販売',
      annualSales: '20億円',
      createdAt: '2022-10-10T00:00:00Z',
      websiteUrl: 'https://lynx.co.jp',
      customerRank: 'A',
      salesType: '直取引',
      creditLimit: '800万円',
      customerContactInfo: 'procurement@lynx.co.jp',
    },
  ];

  const journalEntries: JournalEntry[] = [
    {
      id: 1,
      date: '2025-10-01',
      account: '売上高',
      debit: 0,
      credit: 580000,
      description: '秋季キャンペーンチラシ 納品',
    },
    {
      id: 2,
      date: '2025-10-02',
      account: '外注費',
      debit: 220000,
      credit: 0,
      description: 'デザイン外注費',
    },
    {
      id: 3,
      date: '2025-10-03',
      account: '売掛金',
      debit: 1250000,
      credit: 0,
      description: '株式会社リンクス カタログ制作',
    },
  ];

  const accountItems: AccountItem[] = [
    {
      id: 'acct-001',
      code: '5001',
      name: '売上高',
      categoryCode: '50',
      isActive: true,
      sortOrder: 1,
      createdAt: '2022-04-01T00:00:00Z',
      updatedAt: '2025-04-01T00:00:00Z',
    },
    {
      id: 'acct-002',
      code: '5201',
      name: '外注費',
      categoryCode: '52',
      isActive: true,
      sortOrder: 2,
      createdAt: '2022-04-01T00:00:00Z',
      updatedAt: '2025-04-01T00:00:00Z',
    },
    {
      id: 'acct-003',
      code: '6101',
      name: '人件費',
      categoryCode: '61',
      isActive: true,
      sortOrder: 3,
      createdAt: '2022-04-01T00:00:00Z',
      updatedAt: '2025-04-01T00:00:00Z',
    },
    { id: 'acct-6001', code: '6001', name: '旅費交通費', categoryCode: 'EXP_TRAVEL', isActive: true, sortOrder: 10, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'acct-6002', code: '6002', name: '通信費', categoryCode: 'EXP_COMM', isActive: true, sortOrder: 20, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'acct-6003', code: '6003', name: '消耗品費', categoryCode: 'EXP_SUPPLIES', isActive: true, sortOrder: 30, createdAt: '2024-01-01', updatedAt: '2024-01-01' }
  ];

  const leads: Lead[] = [
    {
      id: 'lead-001',
      status: LeadStatus.Contacted,
      createdAt: '2025-09-18T02:15:00Z',
      name: '鈴木 一郎',
      email: 'suzuki@example.com',
      phone: '045-123-4567',
      company: '株式会社アーク',
      source: '展示会',
      tags: ['印刷', '大型案件'],
      message: '大型イベント用のパンフレット制作を検討しています。',
      updatedAt: '2025-09-25T11:22:00Z',
      referrer: null,
      referrerUrl: null,
      landingPageUrl: null,
      searchKeywords: null,
      utmSource: 'expo',
      utmMedium: 'offline',
      utmCampaign: 'autumn_fair',
      utmTerm: null,
      utmContent: null,
      userAgent: null,
      ipAddress: null,
      deviceType: null,
      browserName: null,
      osName: null,
      country: '日本',
      city: '横浜市',
      region: '神奈川県',
      employees: '120名',
      budget: '300万円',
      timeline: '11月中旬納品希望',
      inquiryType: 'デモ依頼',
      inquiryTypes: ['デモ依頼', '見積依頼'],
      infoSalesActivity: '10/01 オンラインデモ実施。詳細見積もり提出予定。',
      score: 78,
    },
    {
      id: 'lead-002',
      status: LeadStatus.Qualified,
      createdAt: '2025-09-01T07:00:00Z',
      name: '松本 里奈',
      email: 'rina.matsumoto@example.com',
      phone: '078-987-6543',
      company: '株式会社ライトアップ',
      source: 'Webサイト',
      tags: ['短納期'],
      message: '採用パンフレットの制作を依頼したいです。',
      updatedAt: '2025-09-15T09:30:00Z',
      referrer: null,
      referrerUrl: null,
      landingPageUrl: 'https://example.com/lp',
      searchKeywords: '採用パンフレット 印刷',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'recruit-ads',
      utmTerm: '採用パンフレット',
      utmContent: 'text_ad',
      userAgent: null,
      ipAddress: null,
      deviceType: 'desktop',
      browserName: 'Chrome',
      osName: 'Windows',
      country: '日本',
      city: '神戸市',
      region: '兵庫県',
      employees: '80名',
      budget: '180万円',
      timeline: '12月初旬納品',
      inquiryType: '導入相談',
      inquiryTypes: ['導入相談'],
      infoSalesActivity: '要件定義完了。10/20 契約予定。',
      score: 84,
    },
  ];

  const employeeUsers: EmployeeUser[] = [
    {
      id: 'user-001',
      name: '田中 翔',
      department: '営業部',
      title: 'マネージャー',
      email: 'sho.tanaka@example.com',
      role: 'admin',
      createdAt: '2023-01-15T00:00:00Z',
    },
    {
      id: 'user-002',
      name: '高橋 美咲',
      department: '営業部',
      title: 'シニアセールス',
      email: 'misaki.takahashi@example.com',
      role: 'user',
      createdAt: '2023-05-12T00:00:00Z',
    },
    {
      id: 'user-003',
      name: '佐々木 大樹',
      department: '製造部',
      title: '工場長',
      email: 'daiki.sasaki@example.com',
      role: 'user',
      createdAt: '2022-11-01T00:00:00Z',
    },
  ];

  const employees: Employee[] = [
    {
      id: 'emp-001',
      name: '田中 翔',
      department: '営業部',
      title: 'マネージャー',
      hireDate: '2018-04-01',
      salary: 7200000,
      createdAt: '2018-04-01T00:00:00Z',
    },
    {
      id: 'emp-002',
      name: '高橋 美咲',
      department: '営業部',
      title: 'シニアセールス',
      hireDate: '2020-07-01',
      salary: 5400000,
      createdAt: '2020-07-01T00:00:00Z',
    },
    {
      id: 'emp-003',
      name: '佐々木 大樹',
      department: '製造部',
      title: '工場長',
      hireDate: '2015-02-15',
      salary: 6600000,
      createdAt: '2015-02-15T00:00:00Z',
    },
  ];

  const approvalRoutes: ApprovalRoute[] = [
    {
      id: 'route-001',
      name: '営業経費申請ルート',
      routeData: {
        steps: [
          { approverId: 'user-001' },
          { approverId: 'user-002' },
        ],
      },
      createdAt: '2024-01-05T00:00:00Z',
    },
    {
      id: 'route-002',
      name: '製造部 稟議ルート',
      routeData: {
        steps: [
          { approverId: 'user-003' },
          { approverId: 'user-001' },
        ],
      },
      createdAt: '2024-03-12T00:00:00Z',
    },
    {
      id: 'route-prez',
      name: '社長決裁ルート',
      routeData: {
        steps: [
          { approverId: 'user-001' }, // 田中 翔 (Manager/Admin) as President
        ],
      },
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  const applicationCodes: ApplicationCode[] = [
    { id: 'code-exp', code: 'EXP', name: '経費精算', description: '経費精算申請', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'code-trp', code: 'TRP', name: '交通費申請', description: '交通費申請', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'code-lev', code: 'LEV', name: '休暇申請', description: '休暇申請', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'code-apl', code: 'APL', name: '稟議申請', description: '稟議申請', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'code-dly', code: 'DLY', name: '日報', description: '日報', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'code-wkr', code: 'WKR', name: '週報', description: '週報', createdAt: '2024-01-01T00:00:00Z' },
  ];

  const applications: ApplicationWithDetails[] = [
    {
      id: 'app-001',
      applicantId: 'user-002',
      applicationCodeId: 'code-exp',
      formData: {
        purpose: '得意先訪問の交通費精算',
        amount: 12840,
        notes: '10/3 東京メトロ利用',
      },
      status: 'pending_approval',
      submittedAt: '2025-10-04T02:45:00Z',
      approvedAt: null,
      rejectedAt: null,
      currentLevel: 1,
      approverId: 'user-001',
      rejectionReason: null,
      approvalRouteId: 'route-001',
      createdAt: '2025-10-04T02:45:00Z',
      applicant: employeeUsers.find(u => u.id === 'user-002'),
      applicationCode: applicationCodes.find(c => c.id === 'code-exp'),
      approvalRoute: approvalRoutes.find(r => r.id === 'route-001'),
    },
    {
      id: 'app-002',
      applicantId: 'user-003',
      applicationCodeId: 'code-apl',
      formData: {
        title: '新型オンデマンド印刷機導入',
        amount: 4800000,
        roi: '2年で投資回収見込み',
      },
      status: 'draft',
      submittedAt: null,
      approvedAt: null,
      rejectedAt: null,
      currentLevel: 0,
      approverId: null,
      rejectionReason: null,
      approvalRouteId: 'route-002',
      createdAt: '2025-09-28T07:10:00Z',
      applicant: employeeUsers.find(u => u.id === 'user-003'),
      applicationCode: applicationCodes.find(c => c.id === 'code-apl'),
      approvalRoute: approvalRoutes.find(r => r.id === 'route-002'),
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: 'po-001',
      supplierName: '東都紙業株式会社',
      itemName: 'コート紙 90kg (1091×788)',
      orderDate: '2025-10-05',
      quantity: 2000,
      unitPrice: 38,
      status: PurchaseOrderStatus.Ordered,
    },
    {
      id: 'po-002',
      supplierName: '京浜加工サービス',
      itemName: 'PP加工（グロス）',
      orderDate: '2025-10-03',
      quantity: 15000,
      unitPrice: 12,
      status: PurchaseOrderStatus.Received,
    },
  ];

  const inventoryItems: InventoryItem[] = [
    {
      id: 'inv-001',
      name: 'コート紙 90kg',
      category: '用紙',
      quantity: 5400,
      unit: '枚',
      unitPrice: 36,
    },
    {
      id: 'inv-002',
      name: 'マットコート紙 110kg',
      category: '用紙',
      quantity: 2100,
      unit: '枚',
      unitPrice: 42,
    },
    {
      id: 'inv-003',
      name: 'PPフィルム (グロス)',
      category: '加工資材',
      quantity: 35,
      unit: '巻',
      unitPrice: 9500,
    },
  ];

  const bugReports: BugReport[] = [
    {
      id: 'bug-001',
      reporterName: '高橋 美咲',
      reportType: 'improvement',
      summary: '案件検索のフィルタ条件を保存したい',
      description: '営業チームから、案件検索の条件を保存できるようにして欲しいという要望があります。',
      status: BugReportStatus.Open,
      createdAt: '2025-10-02T04:30:00Z',
    },
    {
      id: 'bug-002',
      reporterName: '田中 翔',
      reportType: 'bug',
      summary: '案件詳細で見積履歴が表示されない',
      description: '案件詳細モーダルの「見積履歴」タブにデータが表示されなくなっています。',
      status: BugReportStatus.InProgress,
      createdAt: '2025-09-25T01:15:00Z',
    },
  ];

  const estimates: Estimate[] = [
    {
      id: 'est-001',
      estimateNumber: 23045,
      customerName: '株式会社ネオプリント',
      title: '秋季キャンペーンチラシ制作',
      items: createEstimateItems([
        {
          division: 'デザイン・DTP代',
          content: 'デザインディレクション費',
          quantity: 1,
          unit: '式',
          unitPrice: 80000,
          price: 80000,
          cost: 30000,
          costRate: 37.5,
          subtotal: 80000,
        },
        {
          division: '印刷代',
          content: 'チラシ印刷（A4 両面）',
          quantity: 15000,
          unit: '枚',
          unitPrice: 20,
          price: 300000,
          cost: 180000,
          costRate: 60,
          subtotal: 300000,
        },
        {
          division: '加工代',
          content: 'PP加工（グロス）',
          quantity: 15000,
          unit: '枚',
          unitPrice: 12,
          price: 180000,
          cost: 90000,
          costRate: 50,
          subtotal: 180000,
        },
      ]),
      total: 560000,
      deliveryDate: '2025-11-05',
      paymentTerms: '月末締め翌月末払い',
      deliveryMethod: '指定倉庫へ納品',
      notes: '校正2回まで含む',
      status: EstimateStatus.Ordered,
      version: 3,
      userId: 'user-001',
      user: employeeUsers[0],
      createdAt: '2025-10-04T03:30:00Z',
      updatedAt: '2025-10-04T03:30:00Z',
    },
    {
      id: 'est-002',
      estimateNumber: 23046,
      customerName: '有限会社ブルースタジオ',
      title: '会社案内パンフレット',
      items: createEstimateItems([
        {
          division: 'デザイン・DTP代',
          content: 'アートディレクション',
          quantity: 1,
          unit: '式',
          unitPrice: 120000,
          price: 120000,
          cost: 50000,
          costRate: 41.6,
          subtotal: 120000,
        },
        {
          division: '印刷代',
          content: 'パンフレット印刷（12P 中綴じ）',
          quantity: 3000,
          unit: '冊',
          unitPrice: 120,
          price: 360000,
          cost: 210000,
          costRate: 58.3,
          subtotal: 360000,
        },
      ]),
      total: 560000,
      deliveryDate: '2025-10-30',
      paymentTerms: '納品月末締め翌月末払い',
      deliveryMethod: '本社受け渡し',
      notes: '撮影費別途見積',
      status: EstimateStatus.Draft,
      version: 1,
      userId: 'user-002',
      user: employeeUsers[1],
      createdAt: '2025-09-25T05:20:00Z',
      updatedAt: '2025-09-25T05:20:00Z',
    },
  ];

  const invoiceItems: InvoiceItem[] = [
    {
      id: 'inv-item-001',
      invoiceId: 'inv-001',
      jobId: 'job-003',
      description: '商品カタログ2025 制作費',
      quantity: 1,
      unit: '式',
      unitPrice: 1250000,
      lineTotal: 1250000,
      sortIndex: 0,
    },
  ];

  const invoices: Invoice[] = [
    {
      id: 'inv-001',
      invoiceNo: 'INV-20240912',
      invoiceDate: '2025-09-12',
      customerName: '株式会社リンクス',
      subtotalAmount: 1250000,
      taxAmount: 125000,
      totalAmount: 1375000,
      status: 'issued',
      createdAt: '2025-09-12T00:00:00Z',
      paidAt: null,
      items: clone(invoiceItems),
    },
  ];

  const inboxItems: InboxItem[] = [
    {
      id: 'inbox-001',
      fileName: 'invoice-20241005.pdf',
      filePath: 'demo/invoice-20241005.pdf',
      fileUrl: 'https://example.com/demo/invoice-20241005.pdf',
      mimeType: 'application/pdf',
      status: InboxItemStatus.PendingReview,
      extractedData: {
        vendorName: '東都紙業株式会社',
        invoiceDate: '2025-10-05',
        totalAmount: 76000,
        description: '用紙仕入',
        costType: 'V',
        account: '仕入高',
        relatedCustomer: '株式会社ネオプリント',
        project: '秋季キャンペーンチラシ',
      },
      errorMessage: null,
      createdAt: '2025-10-05T06:30:00Z',
    },
  ];
  
  const departments: Department[] = [
    { id: 'dep-1', name: '総務部' },
    { id: 'dep-2', name: '経理部' },
    { id: 'dep-3', name: '営業部' },
    { id: 'dep-4', name: '制作部' },
  ];
  
  const paymentRecipients: PaymentRecipient[] = [
    {
      id: 'rec-1',
      recipientCode: 'V001',
      companyName: '東日本旅客鉄道株式会社',
      recipientName: 'JR東日本',
      bankName: 'みずほ銀行',
      bankBranch: '本店営業部',
      bankAccountType: '普通',
      bankAccountNumber: '1234567',
      invoiceRegistrationNumber: 'T1010101010101',
    },
    {
      id: 'rec-2',
      recipientCode: 'V002',
      companyName: 'KDDI株式会社',
      recipientName: 'KDDI',
      bankName: '三井住友銀行',
      bankBranch: '青山支店',
      bankAccountType: '当座',
      bankAccountNumber: '7654321',
      invoiceRegistrationNumber: 'T2020202020202',
    },
  ];

  return {
    jobs,
    customers,
    journalEntries,
    accountItems,
    leads,
    approvalRoutes,
    purchaseOrders,
    inventoryItems,
    employees,
    employeeUsers,
    bugReports,
    estimates,
    applications,
    applicationCodes,
    invoices,
    inboxItems,
    departments,
    paymentRecipients,
  };
};

export const cloneDemoState = (state: DemoDataState): DemoDataState => clone(state);
