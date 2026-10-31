import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are off, so Testing Library cannot register this itself. Without it a component
// from one test stays mounted: its listeners keep running and React can schedule work that fires
// after the test file is done, which fails CI with "window is not defined".
afterEach(() => cleanup())
