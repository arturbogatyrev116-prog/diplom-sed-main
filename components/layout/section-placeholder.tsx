import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionPlaceholderProps = {
  title: string;
  description?: string;
};

export function SectionPlaceholder({ title, description }: SectionPlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Раздел в разработке — навигация и каркас интерфейса готовы для демонстрации.
      </CardContent>
    </Card>
  );
}
