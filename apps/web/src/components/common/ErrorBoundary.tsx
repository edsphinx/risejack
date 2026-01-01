/**
 * ErrorBoundary - Catches errors in child components
 * Prevents entire app from crashing if a modal fails
 */

import { Component } from 'preact';
import type { ComponentChildren } from 'preact';

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error for debugging
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback or default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <p>Something went wrong. Please refresh the page.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>Try Again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * ModalErrorBoundary - Specialized error boundary for modals
 * Silently dismisses on error instead of showing error UI
 */
interface ModalErrorBoundaryProps {
  children: ComponentChildren;
  onDismiss: () => void;
}

export class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Modal error:', error);
    // Dismiss modal on error to prevent blocking UI
    this.props.onDismiss();
  }

  render() {
    if (this.state.hasError) {
      return null; // Don't render anything - modal is dismissed
    }
    return this.props.children;
  }
}
