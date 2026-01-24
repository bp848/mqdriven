declare module '@/components/ui/button' {
  export const Button: any;
}

declare module '@/components/ui/badge' {
  export const Badge: any;
}

declare module '@/components/ui/card' {
  export const Card: any;
  export const CardContent: any;
  export const CardHeader: any;
  export const CardTitle: any;
}

declare module '@/components/ui/input' {
  export const Input: any;
}

declare module '@/components/ui/table' {
  export const Table: any;
  export const TableBody: any;
  export const TableCell: any;
  export const TableHead: any;
  export const TableHeader: any;
  export const TableRow: any;
}

declare module '@/components/ui/select' {
  export const Select: any;
  export const SelectContent: any;
  export const SelectItem: any;
  export const SelectTrigger: any;
  export const SelectValue: any;
}

declare module '@/components/ui/textarea' {
  export const Textarea: any;
}

declare module '@/components/ui/tabs' {
  export const Tabs: any;
  export const TabsContent: any;
  export const TabsList: any;
  export const TabsTrigger: any;
}

declare module 'next' {
  export type NextApiRequest = any;
  export type NextApiResponse = any;
  const next: any;
  export default next;
}

declare module 'next/router' {
  export const useRouter: any;
  export const withRouter: any;
}
