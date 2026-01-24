import React from "react";

type P = { children: React.ReactNode };
type S = { hasError: boolean; msg?: string };

export default class ErrorBoundary extends React.Component<P, S> {
  state: S;
  props: P;
  
  constructor(p: P) {
    super(p);
    this.props = p;
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(e: unknown): Partial<S> {
    return { hasError: true, msg: String(e) };
  }
  
  componentDidCatch(e: unknown, info: unknown): void {
    console.error("ErrorBoundary", e, info);
  }
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="container" style={{paddingTop:24}}>
          <h1>問題が発生しました</h1>
          <p style={{whiteSpace:"pre-wrap",opacity:.8,fontSize:14}}>
            {this.state.msg||"不明なエラー"}
          </p>
          <button onClick={() => location.reload()}>再読込</button>
        </div>
      );
    }
    return this.props.children;
  }
}
