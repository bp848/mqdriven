"use client"

import { useState } from "react"
import { X, Pencil, Mail, Check, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type TabType = "返信案" | "見積案" | "提案"

export default function LeadDetailPage() {
  const [activeTab, setActiveTab] = useState<TabType>("返信案")
  const [checkedItems, setCheckedItems] = useState<Record<TabType, boolean>>({
    "返信案": false,
    "見積案": false,
    "提案": false,
  })

  const toggleCheck = (tab: TabType) => {
    setCheckedItems(prev => ({ ...prev, [tab]: !prev[tab] }))
  }

  const allChecked = Object.values(checkedItems).every(Boolean)

  return (
    <div className="h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[calc(100vh-2rem)] rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-zinc-900">リード詳細</h1>
            <div className="flex items-center gap-2">
              <Badge className="bg-zinc-800 text-white text-xs">新規</Badge>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-green-600" />
                企業調査完了
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8 bg-transparent">
              <Pencil className="w-3 h-3 mr-1" />
              編集
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
              <Mail className="w-3 h-3 mr-1" />
              メール確認
            </Button>
            <button type="button" className="text-zinc-400 hover:text-zinc-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content: 左=顧客の内容、右=AI提案 */}
        <div className="flex-1 grid grid-cols-2 min-h-0">
          {/* 左カラム: 顧客からの内容 */}
          <div className="border-r border-zinc-200 p-6 flex flex-col overflow-auto">
            <h2 className="text-sm font-bold text-zinc-900 mb-4">顧客からの内容</h2>
            
            {/* 顧客情報 */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200 mb-4">
              <p className="font-bold text-base text-zinc-900">
                <span className="bg-yellow-200/80 px-0.5">Acroforce株式会社</span>
              </p>
              <p className="text-sm text-zinc-600 mt-1">橋本　直人</p>
              <p className="text-xs text-zinc-500">sales@growthstage.jp / 03-6416-0401</p>
            </div>

            {/* 問い合わせ内容 */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200 flex-1">
              <h3 className="text-xs font-bold text-zinc-700 mb-2">問い合わせ内容</h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                新卒採用ご担当者様 あけましておめでとうございます！ Acroforce株式会社 取締役の橋本と申します。 年が明け、27卒学生はいよいよ本選考直前の最終整理フェーズに入っています。 この時期は、
              </p>
              <p className="text-sm text-zinc-700 leading-relaxed mt-3">
                <span className="bg-purple-200/70 px-0.5">「すでにある母集団に、質の高い学生を追加したい」</span>
                といったご相談も多くいただいております。まずは、貴社に合う学生がいるかどうかの確認からでも構いませんので、お気軽にご連絡ください。
              </p>
            </div>

            {/* 活動履歴 */}
            <div className="mt-4 shrink-0">
              <h3 className="text-xs font-bold text-zinc-700 mb-2">活動履歴</h3>
              <div className="text-xs text-zinc-500 space-y-1">
                <div className="flex justify-between">
                  <span>メール受信</span>
                  <span>2026/01/15 15:09</span>
                </div>
                <div className="flex justify-between">
                  <span>企業調査完了</span>
                  <span>2026/01/15 15:10</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右カラム: AI生成の提案 */}
          <div className="p-6 flex flex-col overflow-hidden">
            <h2 className="text-sm font-bold text-zinc-900 mb-4">AI提案をチェック</h2>

            {/* タブ */}
            <div className="flex gap-1 mb-4 shrink-0">
              {(["返信案", "見積案", "提案"] as TabType[]).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${
                    activeTab === tab
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {checkedItems[tab] && <Check className="w-3 h-3" />}
                  {tab}
                </button>
              ))}
            </div>

            {/* タブコンテンツ */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200 flex-1 flex flex-col overflow-auto">
              {activeTab === "返信案" && (
                <div className="text-sm text-zinc-700 leading-relaxed">
                  <p className="font-medium">Acroforce株式会社 橋本　直人 様</p>
                  <p className="mt-3">お世話になっております。</p>
                  <p>文唱堂印刷の石嶋洋平です。</p>
                  <p className="mt-3">お問い合わせいただきまして、誠にありがとうございます。</p>
                  <p className="mt-3">
                    <span className="bg-purple-200/70 px-0.5">「すでにある母集団に、質の高い学生を追加したい」</span>
                    といったご相談、承りました。
                  </p>
                  <p className="mt-3">弊社では、貴社のニーズに合った質の高い理系学生のご紹介が可能です。まずはオンラインでの簡単なお打ち合わせはいかがでしょうか。</p>
                  <p className="mt-3">ご都合の良い日時をいくつかお知らせいただければ幸いです。</p>
                </div>
              )}
              {activeTab === "見積案" && (
                <div className="text-sm text-zinc-700 leading-relaxed">
                  <p className="font-bold mb-3">見積もり概要</p>
                  <table className="w-full text-left">
                    <tbody>
                      <tr className="border-b border-zinc-200">
                        <td className="py-2 text-zinc-500">採用支援サービス</td>
                        <td className="py-2 text-right">¥300,000</td>
                      </tr>
                      <tr className="border-b border-zinc-200">
                        <td className="py-2 text-zinc-500">学生紹介（5名想定）</td>
                        <td className="py-2 text-right">¥500,000</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold">合計（税抜）</td>
                        <td className="py-2 text-right font-bold">¥800,000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab === "提案" && (
                <div className="text-sm text-zinc-700 leading-relaxed">
                  <p className="font-bold mb-3">提案内容</p>
                  <p>貴社の26卒採用強化に向けて、以下のプランをご提案いたします。</p>
                  <ul className="mt-3 space-y-2 list-disc list-inside">
                    <li>質の高い理系学生10名のリストアップ</li>
                    <li>貴社説明会への集客支援</li>
                    <li>面接対策・フォローアップ</li>
                    <li>内定承諾までの伴走サポート</li>
                  </ul>
                  <p className="mt-3">まずは無料の採用相談からスタートいただけます。</p>
                </div>
              )}
            </div>

            {/* チェック & 次へ */}
            <div className="mt-4 flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={() => toggleCheck(activeTab)}
                className={`flex-1 h-10 text-sm bg-transparent ${
                  checkedItems[activeTab] ? "border-green-500 text-green-600" : ""
                }`}
              >
                <Check className="w-4 h-4 mr-2" />
                {checkedItems[activeTab] ? "確認済み" : "この内容を確認"}
              </Button>
              <Button
                disabled={!allChecked}
                className="flex-1 h-10 text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                次へ進む
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
