import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Thank you for signing up!
              </CardTitle>
              <CardDescription>Check your email to confirm</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You&apos;ve successfully signed up. Please check your email to
                confirm your account before signing in.
              </p>

              <Button asChild size="lg" variant="outline" className="border-gray-300 dark:border-gray-700 w-full mt-5">
                <Link href="/auth/login">
                  Sign In
                </Link>
              </Button>
            </CardContent>
          </Card>
          <div className="flex justify-center items-center flex-col mt-1">
            <Button
              asChild
              size="sm"
              className="bg-transparent hover:bg-transparent  
                  hover:scale-150 transition-transform duration-200 
                  text-gray-900 dark:text-gray-100 rounded-full w-10 h-10 p-0
                  flex items-center justify-center"
            >
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
