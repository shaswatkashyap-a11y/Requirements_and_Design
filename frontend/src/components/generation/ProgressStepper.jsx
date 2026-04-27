import { Search, Layers, CheckCircle2, Clock } from 'lucide-react'

function buildSteps(run) {
  if (!run) return []

  const steps = [
    {
      id: 'extracting_modules',
      label: 'Extracting Modules',
      subtitle: 'Analysing SOW sections and building module map',
      icon: Search,
    },
  ]

  // Build one step per round from artifact_types_requested
  if (run.total_rounds && run.total_rounds > 0) {
    const types = run.artifact_types_requested || []
    // Split types evenly across rounds (approximation — server controls real split)
    const perRound = Math.ceil(types.length / run.total_rounds)
    for (let r = 1; r <= run.total_rounds; r++) {
      const slice = types.slice((r - 1) * perRound, r * perRound)
      steps.push({
        id: `round_${r}`,
        label: `Round ${r}`,
        subtitle: slice.map(displayName).join(', ') || 'Generating artifacts',
        icon: Layers,
      })
    }
  } else {
    // Fallback single generating step
    steps.push({
      id: 'generating_artifacts',
      label: 'Generating Artifacts',
      subtitle: 'Creating all artifact types',
      icon: Layers,
    })
  }

  steps.push({
    id: 'completed',
    label: 'Complete',
    subtitle: 'All artifacts generated successfully',
    icon: CheckCircle2,
  })

  return steps
}

function getActiveIndex(run, steps) {
  if (!run) return 0
  if (run.status === 'extracting_modules') return 0
  if (run.status === 'generating_artifacts') {
    const round = run.current_round || 1
    const idx = steps.findIndex((s) => s.id === `round_${round}`)
    return idx >= 0 ? idx : 1
  }
  if (run.status === 'completed') return steps.length - 1
  return 0
}

const ARTIFACT_DISPLAY_NAMES = {
  functional_req:       'Functional Req.',
  nonfunctional_req:    'Non-Functional',
  task:                 'Tasks',
  test_case:            'Test Cases',
  architecture:         'Architecture',
  risk_entry:           'Risks',
  component_design:     'Comp. Design',
  data_model:           'Data Model',
  traceability_matrix:  'Traceability',
}

function displayName(type) {
  return ARTIFACT_DISPLAY_NAMES[type] || type
}

export default function ProgressStepper({ run }) {
  const steps = buildSteps(run)
  const activeIdx = getActiveIndex(run, steps)
  const isFailed = run?.status === 'failed'

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200" />

      <div className="space-y-1">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isDone = !isFailed && idx < activeIdx
          const isActive = !isFailed && idx === activeIdx
          const isPending = isFailed ? true : idx > activeIdx

          let iconBg, iconColor, textColor
          if (isFailed && isActive) {
            iconBg = 'bg-red-100'; iconColor = 'text-red-500'; textColor = 'text-red-600'
          } else if (isDone) {
            iconBg = 'bg-green-100'; iconColor = 'text-green-600'; textColor = 'text-gray-700'
          } else if (isActive) {
            iconBg = 'bg-blue-600'; iconColor = 'text-white'; textColor = 'text-gray-900'
          } else {
            iconBg = 'bg-gray-100'; iconColor = 'text-gray-400'; textColor = 'text-gray-400'
          }

          return (
            <div key={step.id} className="relative flex items-start gap-4 pl-0 py-3">
              {/* Icon */}
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${iconBg} transition-all`}>
                {isActive && !isFailed ? (
                  <span className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping" />
                ) : null}
                <Icon size={16} className={`${iconColor} relative z-10`} />
              </div>

              {/* Text */}
              <div className="pt-1.5 min-w-0">
                <p className={`text-sm font-semibold ${textColor} transition-colors`}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-400 leading-snug mt-0.5">{step.subtitle}</p>
                {isActive && run?.progress_message && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">{run.progress_message}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
