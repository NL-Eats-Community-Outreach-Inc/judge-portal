'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export function MentorOnboardingForm({ className }: { className?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cf_mentor_name: '',
    cf_mentor_title: '',
    cf_mentor_org: '',
    cf_mentor_bio: '',
    cf_mentor_linkedin: '',
    cf_mentor_email: '',
    cf_mentor_calendly: '',
    cf_mentor_photo: '',
  });

  const [expertise, setExpertise] = useState<string[]>([]);

  // Mock data
  const expertiseOptions = [
    'Software Engineering',
    'Product Management',
    'Design',
    'Marketing',
    'Sales',
    'Other',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const toggleExpertise = (option: string) => {
    setExpertise((prev) =>
      prev.includes(option) ? prev.filter((i) => i !== option) : [...prev, option]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/mentor-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, cf_mentor_expertise: expertise }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setShowSuccess(true);
    } catch (error) {
      console.error('An error occurred during submission: ', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className={cn('w-full max-w-2xl', className)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Submission Successful</CardTitle>
            <CardDescription>Your mentor details have been recorded.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <p className="text-sm text-muted-foreground">
              Thank you for providing your information. Your application has been submitted for
              review. Click the button below to return to your dashboard.
            </p>
            <Button onClick={() => router.push('/participant')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-2xl', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Become a Mentor</CardTitle>
          <CardDescription>
            Fill out the form below to submit your details for the mentor program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="cf_mentor_name">Full Name</Label>
              <Input
                id="cf_mentor_name"
                value={formData.cf_mentor_name}
                onChange={handleInputChange}
                placeholder="Applicant's Name"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cf_mentor_title">Professional Title</Label>
                <Input
                  id="cf_mentor_title"
                  value={formData.cf_mentor_title}
                  onChange={handleInputChange}
                  placeholder="e.g. Senior Developer"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cf_mentor_org">Organization</Label>
                <Input
                  id="cf_mentor_org"
                  value={formData.cf_mentor_org}
                  onChange={handleInputChange}
                  placeholder="Company name"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cf_mentor_email">Contact Email</Label>
              <Input
                id="cf_mentor_email"
                type="email"
                value={formData.cf_mentor_email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Areas of Expertise</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {expertiseOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={expertise.includes(option)}
                      onCheckedChange={() => toggleExpertise(option)}
                    />
                    <label
                      htmlFor={option}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cf_mentor_bio">Short Bio</Label>
              <Textarea
                id="cf_mentor_bio"
                className="min-h-[100px]"
                value={formData.cf_mentor_bio}
                onChange={handleInputChange}
                placeholder="A brief overview of your experience"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cf_mentor_linkedin">LinkedIn URL</Label>
                <Input
                  id="cf_mentor_linkedin"
                  type="url"
                  value={formData.cf_mentor_linkedin}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/..."
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cf_mentor_calendly">Calendly link</Label>
                <Input
                  id="cf_mentor_calendly"
                  type="url"
                  value={formData.cf_mentor_calendly}
                  onChange={handleInputChange}
                  placeholder="https://calendly.com/..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cf_mentor_photo">Profile Photo URL</Label>
                <Input
                  id="cf_mentor_photo"
                  type="url"
                  value={formData.cf_mentor_photo}
                  onChange={handleInputChange}
                  placeholder="https://..."
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
