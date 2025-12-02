import React from 'react';
import { Customer } from '../types';
import { Search, Download, User, Database } from 'lucide-react';

interface DatabaseViewProps {
  customers: Customer[];
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ customers }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Table: customers</h2>
          <p className="text-sm text-gray-500 mt-1">
            Schema: <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">public</span>
          </p>
        </div>
        <div className="flex gap-2">
           <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-mono font-medium text-gray-500 uppercase tracking-wider">id</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-mono font-medium text-gray-500 uppercase tracking-wider">representative_name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-mono font-medium text-gray-500 uppercase tracking-wider">customer_name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-mono font-medium text-gray-500 uppercase tracking-wider">contact_info / phone</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-mono font-medium text-gray-500 uppercase tracking-wider">created_at</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Database className="w-8 h-8 opacity-20" />
                      <p>No rows in table.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                      {customer.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.representative_name}</div>
                          <div className="text-xs text-gray-500">{customer.note}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.customer_name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{customer.website_url}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.customer_contact_info}</div>
                      <div className="text-xs text-gray-500">{customer.phone_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
          <span>{customers.length} rows</span>
          <span>Latency: 24ms</span>
        </div>
      </div>
    </div>
  );
};