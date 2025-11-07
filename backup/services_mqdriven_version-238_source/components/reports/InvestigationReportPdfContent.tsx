import React from 'react';
import { CompanyAnalysis, CompanyInvestigation } from '../../types';

interface InvestigationReportPdfContentProps {
  report: {
    title: string;
    sections: Partial<CompanyAnalysis> & Partial<CompanyInvestigation>;
  };
}

const InvestigationReportPdfContent: React.FC<InvestigationReportPdfContentProps> = ({ report }) => {
  const { title, sections } = report;

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
    pageBreakAfter: 'always',
  };

  const coverPageStyle: React.CSSProperties = {
    ...pageStyle,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
  };
  
  const contentPageStyle: React.CSSProperties = {
    ...pageStyle,
  };

  const h1Style: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '15px', lineHeight: 1.4 };
  const h2Style: React.CSSProperties = { fontSize: '18px', fontWeight: 'bold', color: '#1E40AF', borderLeft: '4px solid #3B82F6', paddingLeft: '12px', marginTop: '25px', marginBottom: '12px' };
  const pStyle: React.CSSProperties = { fontSize: '11px', lineHeight: 1.8, color: '#374151' };

  return (
    <div id="investigation-report-pdf-content" style={containerStyle}>
      {/* Cover Page */}
      <div style={coverPageStyle}>
        <div style={{ borderTop: '2px solid #3B82F6', borderBottom: '2px solid #3B82F6', padding: '30px 0', width: '90%' }}>
            <h1 style={{ ...h1Style, fontSize: '32px' }}>{title}</h1>
            <p style={{ fontSize: '16px', color: '#555' }}>AIによるWebリサーチレポート</p>
            <div style={{ marginTop: '60px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold' }}>文唱堂印刷株式会社</p>
                <p style={{ fontSize: '12px' }}>{new Date().toLocaleDateString('ja-JP')}</p>
            </div>
        </div>
      </div>

      {/* Content Pages */}
      <div style={contentPageStyle}>
        <div style={{flexGrow: 1}}>
            {sections.summary && (
              <>
                <h2 style={h2Style}>企業概要</h2>
                <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{sections.summary}</p>
              </>
            )}
            {sections.swot && (
              <>
                <h2 style={h2Style}>SWOT分析</h2>
                <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{sections.swot}</p>
              </>
            )}
            {sections.painPointsAndNeeds && (
              <>
                <h2 style={h2Style}>課題と潜在的ニーズ</h2>
                <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{sections.painPointsAndNeeds}</p>
              </>
            )}
             {sections.suggestedActions && (
              <>
                <h2 style={h2Style}>提案アクション</h2>
                <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{sections.suggestedActions}</p>
              </>
            )}
            {sections.sources && sections.sources.length > 0 && (
                <>
                <h2 style={h2Style}>情報源</h2>
                <ul style={{ ...pStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                    {sections.sources.map((source, index) => (
                        <li key={index} style={{ marginBottom: '5px' }}>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                                {source.title || source.uri}
                            </a>
                        </li>
                    ))}
                </ul>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default InvestigationReportPdfContent;