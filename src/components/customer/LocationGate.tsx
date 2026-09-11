import { useState } from 'react'
import {
  MapPin,
  ShieldCheck,
  Navigation,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Compass,
  Radio,
} from 'lucide-react'
import logo from '@/assets/images/monolith-logo-nobg.png'
import { useLocationVerification } from '@/contexts/LocationVerificationContext'
import { formatDistance } from '@/config/locationConfig'

export function LocationGate() {
  const {
    status,
    closestLocation,
    distanceMeters,
    allowedRadiusMeters,
    accuracy,
    errorMessage,
    isBorderline,
    checkLocation,
    retry,
  } = useLocationVerification()

  const [showTroubleshooting, setShowTroubleshooting] = useState(false)
  const isChecking = status === 'checking_location' || status === 'requesting_permission'

  const targetRadius = allowedRadiusMeters ?? 150
  const venueName = closestLocation?.name ?? 'Siena College of Taytay'

  return (
    <div className="min-h-screen w-full bg-[#F1F6F9] flex flex-col items-center justify-between p-4 sm:p-6 text-[#14274E] relative overflow-hidden select-none">
      {/* Subtle Background Radial Elements */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#E9C46A]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#14274E]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Branding */}
      <header className="w-full max-w-md flex items-center justify-between pt-2 pb-4 z-10">
        <div className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="Monolith"
            className="w-9 h-9 object-contain drop-shadow-xs"
          />
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-[#14274E] leading-tight">
              MONOLITH
            </h1>
            <p className="text-[10px] font-semibold text-[#394867] tracking-wider uppercase">
              Order Station
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-[#14274E]/15 shadow-2xs backdrop-blur-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#14274E]" />
          <span className="text-[10px] font-bold text-[#14274E]">Protected Access</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md flex-1 flex flex-col justify-center my-auto z-10 py-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#14274E]/5 border border-[#14274E]/10 backdrop-blur-md relative">

          {/* ── 1. CHECKING LOCATION STATE ── */}
          {isChecking && (
            <div className="flex flex-col items-center text-center animate-fade-in py-6">
              {/* Radar pulse animation */}
              <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full bg-[#E9C46A]/20 animate-ping" />
                <div className="absolute w-18 h-18 rounded-full bg-[#14274E]/10 animate-pulse" />
                <div className="w-14 h-14 rounded-full bg-[#14274E] text-[#E9C46A] flex items-center justify-center shadow-lg shadow-[#14274E]/25 z-10">
                  <Compass className="w-7 h-7 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>

              <h2 className="text-xl font-black text-[#14274E] mb-2 tracking-tight">
                Checking your location…
              </h2>
              <p className="text-xs sm:text-sm text-[#394867] leading-relaxed max-w-xs mb-6">
                Verifying that you are physically within the permitted dining area of{' '}
                <strong className="text-[#14274E] font-bold">{venueName}</strong>.
              </p>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#9BA4B4] bg-[#F1F6F9] px-3.5 py-1.5 rounded-full">
                <Radio className="w-3.5 h-3.5 text-[#E9C46A] animate-pulse" />
                <span>Reading native GPS signal</span>
              </div>
            </div>
          )}

          {/* ── 2. INITIAL / IDLE STATE ── */}
          {status === 'idle' && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-[#E9C46A]/20 text-[#14274E] flex items-center justify-center mb-5 shadow-inner">
                <MapPin className="w-8 h-8 text-[#14274E]" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[#14274E] mb-2 tracking-tight">
                Location Access Required
              </h2>
              <p className="text-xs sm:text-sm text-[#394867] leading-relaxed mb-6">
                To use the customer ordering interface, you must allow browser location access so
                we can verify you are within the permitted restaurant area.
              </p>

              {/* Venue Info Card */}
              <div className="w-full bg-[#F1F6F9] rounded-2xl p-4 border border-[#14274E]/10 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white text-[#14274E] shadow-2xs shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-[#14274E]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#14274E]">Permitted Location</h3>
                    <p className="text-xs text-[#394867] font-medium mt-0.5">{venueName}</p>
                    <p className="text-[11px] text-[#9BA4B4] mt-0.5">
                      Allowed Radius: Within {formatDistance(targetRadius)}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => checkLocation()}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#14274E] hover:bg-[#1f3b73] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-[#14274E]/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-[#E9C46A]" />
                <span>Allow Location Access</span>
              </button>

              <p className="text-[11px] text-[#9BA4B4] mt-4 font-medium">
                Your coordinates are only used once to verify proximity and are never shared.
              </p>
            </div>
          )}

          {/* ── 3. PERMISSION DENIED STATE ── */}
          {status === 'permission_denied' && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>

              <h2 className="text-xl font-black text-[#14274E] mb-2 tracking-tight">
                Location Permission Required
              </h2>
              <p className="text-xs sm:text-sm text-[#394867] leading-relaxed mb-5">
                Location access is required to use this ordering interface. Please allow location access
                in your browser settings, then tap Try Again.
              </p>

              {/* Troubleshooting Instructions Collapsible */}
              <div className="w-full bg-[#F1F6F9] rounded-2xl p-4 border border-[#14274E]/10 mb-6 text-left">
                <button
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="w-full flex items-center justify-between text-xs font-bold text-[#14274E] cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-[#394867]" />
                    How to enable location permission
                  </span>
                  {showTroubleshooting ? (
                    <ChevronUp className="w-4 h-4 text-[#394867]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#394867]" />
                  )}
                </button>

                {showTroubleshooting && (
                  <div className="mt-3 pt-3 border-t border-[#14274E]/10 text-xs text-[#394867] space-y-2.5">
                    <div>
                      <strong className="text-[#14274E] block mb-0.5">iOS Safari:</strong>
                      <span>
                        Tap the <strong>aA</strong> icon in the address bar → <em>Website Settings</em> →{' '}
                        <em>Location</em> → Select <strong>Allow</strong>.
                      </span>
                    </div>
                    <div>
                      <strong className="text-[#14274E] block mb-0.5">Android Chrome:</strong>
                      <span>
                        Tap the <strong>lock/tune</strong> icon next to the URL → <em>Permissions</em> →{' '}
                        <em>Location</em> → Select <strong>Allow</strong>.
                      </span>
                    </div>
                    <div>
                      <strong className="text-[#14274E] block mb-0.5">Desktop Browser:</strong>
                      <span>
                        Click the <strong>padlock</strong> icon in your address bar and toggle Location to <strong>Allow</strong>.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => retry()}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#14274E] hover:bg-[#1f3b73] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-[#14274E]/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#E9C46A]" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* ── 4. OUTSIDE ALLOWED AREA STATE ── */}
          {status === 'outside_allowed_area' && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-5">
                <Navigation className="w-8 h-8 text-red-600 rotate-45" />
              </div>

              <h2 className="text-xl font-black text-[#14274E] mb-2 tracking-tight">
                You're Outside the Allowed Area
              </h2>
              <p className="text-xs sm:text-sm text-[#394867] leading-relaxed mb-5">
                You must be physically within the permitted area around{' '}
                <strong className="text-[#14274E]">{venueName}</strong> to use this ordering interface.
              </p>

              {/* Distance Metrics Box */}
              <div className="w-full bg-[#F1F6F9] rounded-2xl p-4 border border-[#14274E]/10 mb-6 text-left space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#394867] font-medium">Distance from venue:</span>
                  <span className="font-bold text-red-600">
                    {distanceMeters !== null ? formatDistance(distanceMeters) : 'Calculated'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#394867] font-medium">Required proximity:</span>
                  <span className="font-bold text-[#14274E]">
                    Within {formatDistance(targetRadius)}
                  </span>
                </div>
                {accuracy !== null && (
                  <div className="flex justify-between items-center text-[11px] text-[#9BA4B4]">
                    <span>GPS Accuracy margin:</span>
                    <span>±{Math.round(accuracy)} m</span>
                  </div>
                )}
                {isBorderline && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                    Your reading is near the boundary with a wide accuracy circle. Try moving closer or outdoors and re-check.
                  </div>
                )}
              </div>

              <button
                onClick={() => retry()}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#14274E] hover:bg-[#1f3b73] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-[#14274E]/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#E9C46A]" />
                <span>Check Location Again</span>
              </button>
            </div>
          )}

          {/* ── 5. LOCATION UNAVAILABLE / ERROR STATE ── */}
          {(status === 'location_unavailable' || status === 'error') && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <AlertTriangle className="w-8 h-8 text-amber-700" />
              </div>

              <h2 className="text-xl font-black text-[#14274E] mb-2 tracking-tight">
                Unable to Verify Location
              </h2>
              <p className="text-xs sm:text-sm text-[#394867] leading-relaxed mb-5">
                {errorMessage ||
                  "We couldn't determine your current location. Please make sure your device's location services are enabled, then try again."}
              </p>

              <div className="w-full bg-[#F1F6F9] rounded-2xl p-4 border border-[#14274E]/10 mb-6 text-left text-xs text-[#394867] space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#14274E]">•</span>
                  <span>Check that Location/GPS is turned <strong>ON</strong> in phone settings.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#14274E]">•</span>
                  <span>Ensure your device has adequate GPS/cellular reception.</span>
                </div>
              </div>

              <button
                onClick={() => retry()}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#14274E] hover:bg-[#1f3b73] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-[#14274E]/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#E9C46A]" />
                <span>Try Again</span>
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-md text-center py-2 z-10">
        <p className="text-[11px] text-[#9BA4B4]">
          Monolith POS &bull; {venueName} &bull; Radius: {formatDistance(targetRadius)}
        </p>
      </footer>
    </div>
  )
}
