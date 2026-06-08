import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FormField from '../ui/form-field'

describe('FormField', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Test Label">
        <input data-testid="test-input" />
      </FormField>,
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
  })

  it('shows required asterisk', () => {
    render(
      <FormField label="Required Field" required>
        <input />
      </FormField>,
    )
    const label = screen.getByText('Required Field')
    expect(label.parentElement?.querySelector('.text-destructive')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(
      <FormField label="Field" error="This field has an error">
        <input />
      </FormField>,
    )
    expect(screen.getByText('This field has an error')).toBeInTheDocument()
  })

  it('does not show error when none', () => {
    render(
      <FormField label="Field">
        <input />
      </FormField>,
    )
    expect(screen.queryByText('This field has an error')).not.toBeInTheDocument()
  })
})
