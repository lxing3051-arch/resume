import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="main" style={{ padding: 24 }}>
          <h1>页面加载出错</h1>
          <pre className="text-block">{this.state.error.message}</pre>
          <p className="hint">可尝试清除本站数据后刷新，或从看板重新进入。</p>
          <Link className="btn primary" to="/">
            返回看板
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
