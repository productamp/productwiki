import { AppHeader } from '@/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Code, FileText, Sparkles, BookOpen } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">About ProductQ</h1>
          <p className="text-xl text-muted-foreground">
            Turn your codebase into beautiful, up-to-date documentation
          </p>
        </div>

        {/* What ProductQ Does */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            What is ProductQ?
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            ProductQ is a tool that reads your code and automatically creates documentation for you.
            Instead of spending hours writing docs by hand, you simply connect your GitHub repository
            and let ProductQ do the heavy lifting.
          </p>
        </section>

        {/* Code as Source of Truth */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Code className="h-6 w-6 text-primary" />
            Why Code is the Best Source of Truth
          </h2>
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                Traditional documentation has a big problem: it gets outdated. Developers change the code
                but forget to update the docs. Soon, your documentation tells a different story than your
                actual product.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                ProductQ solves this by treating your <strong className="text-foreground">code as the single source of truth</strong>.
                Since documentation is generated directly from your codebase, it always reflects what your
                software actually does — not what it used to do months ago.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* How It Generates Documentation */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            How It Works
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                1
              </div>
              <div>
                <h3 className="font-medium text-lg">Connect Your Repository</h3>
                <p className="text-muted-foreground">
                  Paste your GitHub URL and ProductQ indexes your entire codebase, understanding
                  how all the pieces fit together.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-medium text-lg">AI Analyzes Your Code</h3>
                <p className="text-muted-foreground">
                  Using advanced AI, ProductQ reads through your code to understand what it does,
                  how features work, and how components connect.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-medium text-lg">Documentation Generated</h3>
                <p className="text-muted-foreground">
                  Get comprehensive documentation in minutes — technical docs for developers,
                  product docs for users, or detailed wikis for your team.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How to Use */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Getting Started
          </h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="space-y-3 text-lg text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">1.</span>
                  <span>Go to the <strong className="text-foreground">home page</strong> and paste your GitHub repository URL</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">2.</span>
                  <span>Wait for ProductQ to index your codebase (this only takes a moment)</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">3.</span>
                  <span>Choose the type of documentation you need:
                    <ul className="mt-2 ml-4 space-y-1 text-base">
                      <li>• <strong className="text-foreground">Product Docs</strong> — User-friendly guides</li>
                      <li>• <strong className="text-foreground">Technical Docs</strong> — Developer reference</li>
                    </ul>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">4.</span>
                  <span>Click generate and watch your documentation appear in real-time</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm pt-8 border-t">
          <p>ProductQ — Documentation that stays in sync with your code</p>
        </div>
      </div>
    </div>
  )
}
