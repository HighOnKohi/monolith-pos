import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { BusinessDayProvider } from './contexts/BusinessDayContext'
import { CashierSessionProvider } from './contexts/CashierSessionContext'
import { ServiceSessionProvider } from './contexts/ServiceSessionContext'
import { router } from './routes'

function App() {
  return (
    <AuthProvider>
      <BusinessDayProvider>
        <CashierSessionProvider>
          <ServiceSessionProvider>
            <RouterProvider router={router} />
          </ServiceSessionProvider>
        </CashierSessionProvider>
      </BusinessDayProvider>
    </AuthProvider>
  )
}

export default App
