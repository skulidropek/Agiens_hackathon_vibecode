import React from "react";

interface FileViewerProps {
  filePath: string;
  content?: string;
  onClose: () => void;
  inline?: boolean;
}

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.65)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const boxStyle: React.CSSProperties = {
  background: '#18181b',
  color: '#fff',
  borderRadius: 14,
  boxShadow: '0 4px 32px 0 #000a',
  maxWidth: 900,
  width: '90vw',
  maxHeight: '80vh',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
};
const headerStyle: React.CSSProperties = {
  padding: '18px 24px 12px 24px',
  fontWeight: 700,
  fontSize: 18,
  borderBottom: '1.5px solid #23272e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const codeStyle: React.CSSProperties = {
  fontFamily: 'Fira Mono, Menlo, Monaco, monospace',
  fontSize: 15,
  background: '#23272e',
  color: '#fff',
  borderRadius: 10,
  margin: 0,
  padding: '18px 24px',
  overflowX: 'auto',
  overflowY: 'auto',
  flex: 1,
  minHeight: 200,
  maxHeight: '60vh',
  whiteSpace: 'pre',
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#38bdf8',
  fontWeight: 700,
  fontSize: 20,
  cursor: 'pointer',
  marginLeft: 18,
};

const FileViewer: React.FC<FileViewerProps> = ({ filePath, content, onClose, inline }) => {
  if (inline) {
    return (
      <div style={{ ...boxStyle, maxWidth: '100%', width: '100%', maxHeight: '100%', boxShadow: 'none', borderRadius: 0 }}>
        <div style={headerStyle}>
          <span>{filePath}</span>
          <button style={closeBtnStyle} onClick={onClose} title="Close">×</button>
        </div>
        {content === undefined ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#38bdf8', fontSize: 18 }}>Loading...</div>
        ) : (
          <pre style={codeStyle}>{content}</pre>
        )}
      </div>
    );
  }
  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>{filePath}</span>
          <button style={closeBtnStyle} onClick={onClose} title="Close">×</button>
        </div>
        {content === undefined ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#38bdf8', fontSize: 18 }}>Loading...</div>
        ) : (
          <pre style={codeStyle}>{content}</pre>
        )}
      </div>
    </div>
  );
};

export default FileViewer; 