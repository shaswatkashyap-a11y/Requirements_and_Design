export default function Dashboard() {
  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Welcome to Jade Orion!</h2>
      <p className="text-sm text-gray-700 mb-2">
        Jade Orion is an enterprise-grade AI platform that unifies entire software delivery lifecycle
        into one intelligent, audit-ready flow.
      </p>
      <p className="text-sm text-blue-600 mb-2">
        It takes you from RFP response → SOW Analysis/Generation → Requirements &amp; Design → Code
        analysis → Test generation → Deployment &amp; Post-release insights, with AI guiding each
        step and generating artefacts that support ISO and CMMI-aligned processes.
      </p>
      <p className="text-sm text-gray-700 mb-4">
        Jade Orion acts as a "delivery brain" that sits above tools and technologies, orchestrating
        work across presales, architecture, development, QA, DevOps, and compliance.
      </p>
      <p className="text-sm text-gray-400">Use the left menu to navigate.</p>
    </div>
  )
}