import React from 'react';
import { MarketResearchReport } from '../../types';

interface MarketResearchReportPdfContentProps {
  report: MarketResearchReport;
}

const MarketResearchReportPdfContent: React.FC<MarketResearchReportPdfContentProps> = ({ report }) => {
    const { title, summary, trends, competitorAnalysis, opportunities, threats, sources } = report;

    const containerStyle: React.CSSProperties = {
        width: '210mm',
        fontFamily: "'Noto Sans JP', sans-serif",
        color: '#333',
        backgroundColor: '#fff',
    };

    const pageStyle: React.CSSProperties = {
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
    };
    
    const h1Style: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '15px', lineHeight: 1.4 };
    const h2Style: React.CSSProperties = { fontSize: '18px', fontWeight: 'bold', color: '#1E40AF', borderLeft: '4px solid #3B82F6', paddingLeft: '12px', marginTop: '25px', marginBottom: '12px' };
    const pStyle: React.CSSProperties = { fontSize: '11px', lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' };
    const ulStyle: React.CSSProperties = { ...pStyle, paddingLeft: '20px', listStyleType: 'disc' };
    const liStyle: React.CSSProperties = { marginBottom: '8px' };

    return (
        <div id="market-research-report-pdf-content" style={containerStyle}>
            <div style={pageStyle}>
                <header style={{ textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '20px' }}>
                    <h1 style={{ ...h1Style, fontSize: '32px' }}>市場調査レポート</h1>
                    <p style={{ fontSize: '14px', color: '#555' }}>AIによるWebリサーチ</p>
                </header>
                <main style={{ marginTop: '20px', flexGrow: 1 }}>
                    <h2 style={{ ...h2Style, marginTop: 0 }}>{title}</h2>
                    
                    <h2 style={h2Style}>1. 要約</h2>
                    <p style={pStyle}>{summary}</p>
                    
                    <h2 style={h2Style}>2. 主要トレンド</h2>
                    <ul style={ulStyle}>{trends.map((item, i) => <li key={i} style={liStyle}>{item}</li>)}</ul>

                    <h2 style={h2Style}>3. 競合分析</h2>
                    <p style={pStyle}>{competitorAnalysis}</p>

                    <h2 style={h2Style}>4. ビジネスチャンス</h2>
                    <ul style={ulStyle}>{opportunities.map((item, i) => <li key={i} style={liStyle}>{item}</li>)}</ul>

                    <h2 style={h2Style}>5. 脅威とリスク</h2>
                    <ul style={ulStyle}>{threats.map((item, i) => <li key={i} style={liStyle}>{item}</li>)}</ul>
                    
                    {sources && sources.length > 0 && (
                        <>
                            <h2 style={h2Style}>6. 情報源</h2>
                            <ul style={{ ...pStyle, paddingLeft: '20px', listStyleType: 'decimal', fontSize: '10px' }}>
                                {sources.map((source, i) => (
                                    <li key={i} style={{ marginBottom: '5px' }}>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default MarketResearchReportPdfContent;