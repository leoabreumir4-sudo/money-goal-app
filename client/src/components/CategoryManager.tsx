import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Category {
  id: number;
  name: string;
  emoji: string;
  color: string;
  isDefault?: boolean;
}

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCreateCategory: () => void;
  onDeleteCategory: (id: number) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  newCategoryEmoji: string;
  setNewCategoryEmoji: (emoji: string) => void;
  newCategoryColor: string;
  setNewCategoryColor: (color: string) => void;
  isCreating?: boolean;
}

const emojiOptions = ["💰", "🍔", "🚗", "🏠", "🎮", "💊", "✈️", "📚", "💳", "🎁", "🛒", "☕", "🎬", "💻", "👕", "📱"];
const colorOptions = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899"];

export default function CategoryManager({
  open,
  onOpenChange,
  categories,
  onCreateCategory,
  onDeleteCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryEmoji,
  setNewCategoryEmoji,
  newCategoryColor,
  setNewCategoryColor,
  isCreating = false,
}: CategoryManagerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
          <DialogDescription>
            Crie, edite ou delete suas categorias personalizadas
          </DialogDescription>
        </DialogHeader>

        {/* Create New Category */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <h3 className="font-semibold text-sm">Nova Categoria</h3>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Entretenimento"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewCategoryEmoji(emoji)}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                      newCategoryEmoji === emoji
                        ? "border-primary bg-primary/10 scale-110"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      newCategoryColor === color
                        ? "border-foreground scale-110"
                        : "border-border hover:border-foreground/50"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Button
              onClick={onCreateCategory}
              disabled={!newCategoryName.trim() || isCreating}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? "Criando..." : "Criar Categoria"}
            </Button>
          </div>
        </div>

        {/* Existing Categories */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Categorias Existentes</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {categories.map((category) => (
              <Card key={category.id} className="overflow-hidden">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: category.color + "20" }}
                    >
                      {category.emoji}
                    </div>
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.isDefault && (
                        <p className="text-xs text-muted-foreground">Categoria padrão</p>
                      )}
                    </div>
                  </div>
                  {!category.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteCategory(category.id)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
