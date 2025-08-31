-- Create moods table for World Mood Map
CREATE TABLE public.moods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  mood_emoji TEXT NOT NULL,
  mood_color TEXT NOT NULL,
  mood_name TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  note TEXT CHECK (char_length(note) <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

-- Create policies for public mood access (everyone can view)
CREATE POLICY "Moods are viewable by everyone" 
ON public.moods 
FOR SELECT 
USING (true);

-- Allow anonymous mood sharing
CREATE POLICY "Anyone can create moods" 
ON public.moods 
FOR INSERT 
WITH CHECK (true);

-- Only allow users to update their own moods if they have a user_id
CREATE POLICY "Users can update their own moods" 
ON public.moods 
FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_moods_updated_at
BEFORE UPDATE ON public.moods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time updates
ALTER TABLE public.moods REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moods;