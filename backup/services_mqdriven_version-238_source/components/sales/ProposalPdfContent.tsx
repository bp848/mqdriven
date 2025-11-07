import React from 'react';
import { CustomProposalContent, Lead } from '../../types';

interface ProposalPdfContentProps {
  content: CustomProposalContent;
  lead: Lead;
}

const ProposalPdfContent: React.FC<ProposalPdfContentProps> = ({ content, lead }) => {
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
    position: 'relative',
  };

  const coverPageStyle: React.CSSProperties = {
    ...pageStyle,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
  };
  
  const contentPageStyle: React.CSSProperties = {
    ...pageStyle,
  };

  const coverContentWrapper: React.CSSProperties = {
    width: '100%',
    padding: '20mm',
    boxSizing: 'border-box',
    border: '1px solid #e2e8f0',
    backgroundColor: '#fff',
  };
  
  const h1Style: React.CSSProperties = { fontSize: '28px', fontWeight: 'bold', color: '#1E40AF', marginBottom: '20px', lineHeight: 1.4 };
  const h2Style: React.CSSProperties = { fontSize: '20px', fontWeight: 'bold', color: '#1E40AF', borderLeft: '4px solid #3B82F6', paddingLeft: '12px', marginTop: '30px', marginBottom: '15px' };
  const pStyle: React.CSSProperties = { fontSize: '12px', lineHeight: 1.8, color: '#374151' };

  return (
    <div id="proposal-pdf-content" style={containerStyle}>
      {/* Cover Page */}
      <div style={coverPageStyle}>
          <div style={coverContentWrapper}>
              <p style={{ fontSize: '18px', color: '#64748B' }}>ご提案書</p>
              <h1 style={{ ...h1Style, fontSize: '32px', marginTop: '40px', marginBottom: '40px' }}>{content.coverTitle}</h1>
              <p style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>{lead.company} 御中</p>
              <div style={{ marginTop: '120px', textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: 'bold' }}>文唱堂印刷株式会社</p>
                  <p style={{ fontSize: '12px' }}>{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
          </div>
      </div>

      {/* Content Pages */}
      <div style={contentPageStyle}>
        <div style={{flexGrow: 1}}>
            <h2 style={h2Style}>1. 貴社事業の理解</h2>
            <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{content.businessUnderstanding}</p>
            
            <h2 style={h2Style}>2. 現状の課題と仮説</h2>
            <div style={{...pStyle, whiteSpace: 'pre-wrap'}}>{content.challenges}</div>

            <h2 style={h2Style}>3. 弊社からのご提案</h2>
            <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{content.proposal}</p>
            
            <h2 style={h2Style}>4. 結論</h2>
            <p style={{ ...pStyle, whiteSpace: 'pre-wrap' }}>{content.conclusion}</p>
        </div>
      </div>
    </div>
  );
};

export default ProposalPdfContent;