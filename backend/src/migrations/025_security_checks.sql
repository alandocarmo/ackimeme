-- Adiciona constraint de validação de tamanho para comentários existentes e futuros
ALTER TABLE token_comments ADD CONSTRAINT check_comment_length CHECK (char_length(content) <= 500);

-- Adiciona validação criptográfica (RegEx) para as carteiras no banco de dados
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'wallet_address'
          AND table_schema = 'public'
    LOOP
        -- Adiciona a constraint permitindo o formato de wallet TVM ou o "dev-wallet-local"
        -- Ignora erros caso dados legados (testes) existam e violem a regra provisoriamente
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT valid_wallet_address CHECK (wallet_address ~ ''^-?[0-9]+:[0-9a-fA-F]{64}$'' OR wallet_address = ''dev-wallet-local'' OR wallet_address = '''');', tbl);
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Constraint falhou na tabela % (dados legados podem existir)', tbl;
        END;
    END LOOP;
END
$$;
