import { OnboardingForm } from './onboarding-form';

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-lg space-y-6 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to VoiceAgent</h1>
          <p className="text-muted-foreground">Let's set up your AI receptionist</p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
