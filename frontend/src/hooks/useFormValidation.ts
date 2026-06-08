import { useState, useCallback } from 'react'

type ValidationRule = {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  custom?: (value: unknown) => string | null
}

type ValidationRules<T extends Record<string, unknown>> = {
  [K in keyof T]?: ValidationRule
}

export function useFormValidation<T extends Record<string, unknown>>(
  rules: ValidationRules<T>,
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})

  const validate = useCallback(
    (values: T): boolean => {
      const errs: Partial<Record<keyof T, string>> = {}

      for (const [key, rule] of Object.entries(rules) as [string, ValidationRule][]) {
        const value = values[key]

        if (rule.required && (value === '' || value === null || value === undefined)) {
          errs[key as keyof T] = 'required'
          continue
        }

        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
          errs[key as keyof T] = 'minLength'
          continue
        }

        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
          errs[key as keyof T] = 'maxLength'
          continue
        }

        if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
          errs[key as keyof T] = 'min'
          continue
        }

        if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
          errs[key as keyof T] = 'max'
          continue
        }

        if (rule.custom) {
          const customError = rule.custom(value)
          if (customError) {
            errs[key as keyof T] = customError
          }
        }
      }

      setErrors(errs)
      return Object.keys(errs).length === 0
    },
    [rules],
  )

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const setError = useCallback((field: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
  }, [])

  return { errors, validate, clearErrors, setError, setErrors }
}
