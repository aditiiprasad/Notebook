"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateSummary } from "@/lib/gemini";
import { useChatStore } from "@/lib/store";
import { FileText, Loader2, Upload } from "lucide-react";
import "pdfjs-dist/build/pdf.worker.mjs";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { ChatPanel } from "./chat/panel";

export function Notebook() {
  const [files, setFiles] = useState<Array<{ name: string; content: string }>>(
    []
  );
  const [summaries, setSummaries] = useState<
    Array<{ name: string; summary: string }>
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const { createSession } = useChatStore();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    onDrop: async (acceptedFiles) => {
      setIsProcessing(true);

      for (const file of acceptedFiles) {
        let text = "";

        if (file.type === "application/pdf") {
          const { getDocument } = await import("pdfjs-dist");
          try {
            const pdf = await getDocument(await file.arrayBuffer()).promise;
            const numPages = pdf.numPages;
            for (let i = 1; i <= numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map((item: any) => item.str).join(" ");
            }
          } catch (error) {
            console.error("Error extracting text from PDF:", error);
          }
        } else {
          text = await file.text();
        }

        setFiles((prev) => [...prev, { name: file.name, content: text }]);

        try {
          const summary = await generateSummary(text, (chunk) => {
            setSummaries((prev) => {
              const existing = prev.findIndex((s) => s.name === file.name);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { name: file.name, summary: chunk };
                return updated;
              }
              return [...prev, { name: file.name, summary: chunk }];
            });
          });

          createSession(file.name, text);
          setActiveFile(file.name);
        } catch (error) {
          console.error("Error processing file:", error);
        }
      }

      setIsProcessing(false);
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="p-4 md:col-span-1 border-border bg-card">
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          Documents
        </h2>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Drag & drop PDF or Text files here, or click to select
          </p>
        </div>

        <div className="h-[300px] mt-4 space-y-2">
          {files.map((file, index) => (
            <Button
              key={index}
              variant={activeFile === file.name ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveFile(file.name)}
            >
              <FileText className="h-4 w-4" />
              {file.name}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-4 md:col-span-3 border-border bg-card">
        {isProcessing ? (
          <div className="flex items-center justify-center h-[400px] text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Processing documents...</p>
          </div>
        ) : activeFile ? (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <div className="h-[400px] text-foreground">
                {summaries.find((s) => s.name === activeFile)?.summary ||
                  "No summary available"}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="mt-4">
              <ChatPanel sessionId={activeFile} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Select a document to view its summary and chat
          </div>
        )}
      </Card>
    </div>
  );
}
