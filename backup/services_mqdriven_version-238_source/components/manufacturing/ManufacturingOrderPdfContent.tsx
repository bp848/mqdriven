import React from 'react';
import { Job, ManufacturingStatus } from '../../types';
import { formatDate } from '../../utils';

interface ManufacturingOrderPdfContentProps {
  job: Job;
}

const ManufacturingOrderPdfContent: React.FC<ManufacturingOrderPdfContentProps> = ({ job }) => {
  const containerStyle: React.CSSProperties = {
    width: '210mm',
    fontFamily: "'Noto Sans JP', sans-serif",
    color: '#333',
    backgroundColor: '#fff',
  };

  const pageStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '15mm',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #333',
    paddingBottom: '10px',
  };
  
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1E40AF',
    borderBottom: '2px solid #3B82F6',
    paddingBottom: '5px',
    marginTop: '20px',
    marginBottom: '10px',
  };
  
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 20px',
    fontSize: '11px',
    lineHeight: 1.6,
  };
  
  const fieldStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '90px 1fr',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    padding: '4px 0',
  };
  
  const labelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    color: '#555',
  };

  const processChecklistStyle: React.CSSProperties = {
    ...gridStyle,
    gridTemplateColumns: 'repeat(3, 1fr)',
    marginTop: '15px',
  };
  
  const checkItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  };

  const checkboxStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    border: '1px solid #888',
    flexShrink: 0,
  };

  const processes: ManufacturingStatus[] = [
    ManufacturingStatus.DataCheck,
    ManufacturingStatus.Prepress,
    ManufacturingStatus.Printing,
    ManufacturingStatus.Finishing,
    ManufacturingStatus.AwaitingShipment,
    ManufacturingStatus.Delivered,
  ];

  return (
    <div id="manufacturing-order-pdf-content" style={containerStyle}>
      <div style={pageStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>製造指示書</h1>
            <p style={{ fontSize: '12px', margin: '5px 0 0' }}>発行日: {formatDate(new Date())}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', margin: 0 }}>案件番号: <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{job.jobNumber}</span></p>
            <p style={{ fontSize: '12px', margin: '5px 0 0' }}>納期: <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatDate(job.dueDate)}</span></p>
          </div>
        </header>

        <main style={{ marginTop: '20px' }}>
          <div style={sectionTitleStyle}>案件情報</div>
          <div style={gridStyle}>
            <div style={fieldStyle}><span style={labelStyle}>顧客名:</span><span>{job.clientName}</span></div>
            <div style={fieldStyle}><span style={labelStyle}>案件名:</span><span>{job.title}</span></div>
          </div>

          <div style={sectionTitleStyle}>仕様</div>
          <div style={gridStyle}>
            <div style={fieldStyle}><span style={labelStyle}>数量:</span><span>{job.quantity.toLocaleString()} 部</span></div>
            <div style={fieldStyle}><span style={labelStyle}>用紙:</span><span>{job.paperType}</span></div>
            <div style={fieldStyle}><span style={labelStyle}>加工:</span><span>{job.finishing}</span></div>
          </div>
          <div style={{ ...fieldStyle, gridTemplateColumns: '90px 1fr', marginTop: '10px' }}>
            <span style={labelStyle}>詳細指示:</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{job.details}</span>
          </div>

          <div style={sectionTitleStyle}>工程チェックリスト</div>
          <div style={processChecklistStyle}>
            {processes.map(process => (
              <div key={process} style={checkItemStyle}>
                <div style={checkboxStyle}></div>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{process}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '10px' }}>担当:</p>
                  <p style={{ margin: '4px 0 0', fontSize: '10px' }}>日付:</p>
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #ccc', fontSize: '10px', color: '#888' }}>
          <p>注意事項: 品質管理基準に従い、各工程での確認を徹底してください。問題が発生した場合は、速やかに担当マネージャーに報告すること。</p>
        </footer>
      </div>
    </div>
  );
};

export default ManufacturingOrderPdfContent;