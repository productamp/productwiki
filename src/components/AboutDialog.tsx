import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Code, FileText, Sparkles, BookOpen } from 'lucide-react'

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold text-center">About ProductQ</DialogTitle>
              <p className="text-center text-muted-foreground">
                Turn your codebase into beautiful, up-to-date documentation
              </p>
            </DialogHeader>

            {/* What ProductQ Does */}
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                What is ProductQ?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                ProductQ is a tool that reads your code and automatically creates documentation for you.
                Instead of spending hours writing docs by hand, you simply connect your GitHub repository
                and let ProductQ do the heavy lifting.
              </p>
            </section>

            {/* Code as Source of Truth */}
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Why Code is the Best Source of Truth
              </h2>
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    Traditional documentation has a big problem: it gets outdated. Developers change the code
                    but forget to update the docs. Soon, your documentation tells a different story than your
                    actual product.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    ProductQ solves this by treating your <strong className="text-foreground">code as the single source of truth</strong>.
                    Since documentation is generated directly from your codebase, it always reflects what your
                    software actually does — not what it used to do months ago.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* How It Generates Documentation */}
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                How It Works
              </h2>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Connect Your Repository</h3>
                    <p className="text-sm text-muted-foreground">
                      Paste your GitHub URL and ProductQ indexes your entire codebase, understanding
                      how all the pieces fit together.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium">AI Analyzes Your Code</h3>
                    <p className="text-sm text-muted-foreground">
                      Using advanced AI, ProductQ reads through your code to understand what it does,
                      how features work, and how components connect.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium">Documentation Generated</h3>
                    <p className="text-sm text-muted-foreground">
                      Get comprehensive documentation in minutes — technical docs for developers,
                      product docs for users, or detailed wikis for your team.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* How to Use */}
            <section className="mb-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Getting Started
              </h2>
              <Card>
                <CardContent className="pt-4">
                  <ol className="space-y-2 text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-primary font-semibold">1.</span>
                      <span>Go to the <strong className="text-foreground">home page</strong> and paste your GitHub repository URL</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-semibold">2.</span>
                      <span>Wait for ProductQ to index your codebase (this only takes a moment)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-semibold">3.</span>
                      <span>Choose the type of documentation you need:
                        <ul className="mt-1 ml-4 space-y-1 text-sm">
                          <li>• <strong className="text-foreground">Product Docs</strong> — User-friendly guides</li>
                          <li>• <strong className="text-foreground">Technical Docs</strong> — Developer reference</li>
                        </ul>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-semibold">4.</span>
                      <span>Click generate and watch your documentation appear in real-time</span>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </section>

            {/* Footer */}
            <div className="text-center text-muted-foreground text-xs pt-4 border-t">
              <p>ProductQ — Documentation that stays in sync with your code</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useAboutDialog() {
  const [open, setOpen] = useState(false)
  return { open, setOpen, openAbout: () => setOpen(true) }
}
