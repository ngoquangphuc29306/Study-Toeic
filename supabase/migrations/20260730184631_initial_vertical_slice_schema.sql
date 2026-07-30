-- =====================================================================
-- VOCABTOEIC - PHASE 1A: INITIAL VERTICAL SLICE SCHEMA
-- Migration Version: 20260730_184631
-- Purpose: Create minimum schema for first vertical slice
-- Scope: collections, topics, vocabularies
-- =====================================================================

-- =====================================================================
-- SECTION 1: SHARED UPDATED_AT FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at()
IS 'Sets updated_at to the database server timestamp before a row update.';

-- =====================================================================
-- SECTION 2: COLLECTIONS
-- =====================================================================

CREATE TABLE public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL
        CHECK (
            char_length(btrim(title)) >= 1
            AND char_length(title) <= 200
        ),

    description TEXT
        CHECK (
            description IS NULL
            OR char_length(description) <= 2000
        ),

    icon TEXT NOT NULL DEFAULT 'FolderKanban'
        CHECK (
            char_length(btrim(icon)) >= 1
            AND char_length(icon) <= 50
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT collections_id_user_unique
        UNIQUE (id, user_id)
);

CREATE INDEX idx_collections_user_id
    ON public.collections(user_id);

CREATE INDEX idx_collections_user_created_at
    ON public.collections(user_id, created_at DESC);

CREATE TRIGGER set_updated_at_collections
    BEFORE UPDATE ON public.collections
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.collections
IS 'Private vocabulary collections owned by individual authenticated users.';

COMMENT ON COLUMN public.collections.user_id
IS 'Owner of the collection. Access is restricted by RLS.';

-- =====================================================================
-- SECTION 3: TOPICS
-- =====================================================================

CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    collection_id UUID NOT NULL,
    user_id UUID NOT NULL,

    title TEXT NOT NULL
        CHECK (
            char_length(btrim(title)) >= 1
            AND char_length(title) <= 200
        ),

    description TEXT
        CHECK (
            description IS NULL
            OR char_length(description) <= 2000
        ),

    icon TEXT NOT NULL DEFAULT 'BookOpen'
        CHECK (
            char_length(btrim(icon)) >= 1
            AND char_length(icon) <= 50
        ),

    category TEXT NOT NULL DEFAULT 'General'
        CHECK (
            char_length(btrim(category)) >= 1
            AND char_length(category) <= 100
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT topics_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT topics_collection_owner_fk
        FOREIGN KEY (collection_id, user_id)
        REFERENCES public.collections(id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT topics_id_user_unique
        UNIQUE (id, user_id)
);

CREATE INDEX idx_topics_user_id
    ON public.topics(user_id);

CREATE INDEX idx_topics_collection_id
    ON public.topics(collection_id);

CREATE INDEX idx_topics_user_collection
    ON public.topics(user_id, collection_id);

CREATE INDEX idx_topics_user_created_at
    ON public.topics(user_id, created_at DESC);

CREATE TRIGGER set_updated_at_topics
    BEFORE UPDATE ON public.topics
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.topics
IS 'Private topics inside collections. Composite foreign key enforces the same owner as the parent collection.';

COMMENT ON COLUMN public.topics.collection_id
IS 'Parent collection ID. Parent collection must have the same user_id.';

-- =====================================================================
-- SECTION 4: VOCABULARIES
-- =====================================================================

CREATE TABLE public.vocabularies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    topic_id UUID NOT NULL,
    user_id UUID NOT NULL,

    word TEXT NOT NULL
        CHECK (
            char_length(btrim(word)) >= 1
            AND char_length(word) <= 200
        ),

    phonetic_uk TEXT
        CHECK (
            phonetic_uk IS NULL
            OR char_length(phonetic_uk) <= 100
        ),

    phonetic_us TEXT
        CHECK (
            phonetic_us IS NULL
            OR char_length(phonetic_us) <= 100
        ),

    part_of_speech TEXT NOT NULL DEFAULT 'noun'
        CHECK (
            char_length(btrim(part_of_speech)) >= 1
            AND char_length(part_of_speech) <= 50
        ),

    meaning TEXT NOT NULL
        CHECK (
            char_length(btrim(meaning)) >= 1
            AND char_length(meaning) <= 4000
        ),

    example TEXT
        CHECK (
            example IS NULL
            OR char_length(example) <= 4000
        ),

    example_translation TEXT
        CHECK (
            example_translation IS NULL
            OR char_length(example_translation) <= 4000
        ),

    synonyms TEXT
        CHECK (
            synonyms IS NULL
            OR char_length(synonyms) <= 2000
        ),

    collocations TEXT
        CHECK (
            collocations IS NULL
            OR char_length(collocations) <= 2000
        ),

    audio_url TEXT
        CHECK (
            audio_url IS NULL
            OR char_length(audio_url) <= 500
        ),

    note TEXT
        CHECK (
            note IS NULL
            OR char_length(note) <= 4000
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT vocabularies_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT vocabularies_topic_owner_fk
        FOREIGN KEY (topic_id, user_id)
        REFERENCES public.topics(id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_vocabularies_user_id
    ON public.vocabularies(user_id);

CREATE INDEX idx_vocabularies_topic_id
    ON public.vocabularies(topic_id);

CREATE INDEX idx_vocabularies_user_topic
    ON public.vocabularies(user_id, topic_id);

CREATE INDEX idx_vocabularies_user_word_lower
    ON public.vocabularies(user_id, lower(word));

CREATE INDEX idx_vocabularies_user_created_at
    ON public.vocabularies(user_id, created_at DESC);

CREATE TRIGGER set_updated_at_vocabularies
    BEFORE UPDATE ON public.vocabularies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.vocabularies
IS 'Private vocabulary entries. Composite foreign key enforces the same owner as the parent topic.';

COMMENT ON COLUMN public.vocabularies.topic_id
IS 'Parent topic ID. Parent topic must have the same user_id.';